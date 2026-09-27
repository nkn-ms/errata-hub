"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalIsbn } from "@/utils/isbn";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { sanitizeExternalUrl } from "@/utils/external-url";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { ReportSchema, type ReportInput, type SubmittedBook } from "@/features/report/schema";
import { fetchOpenBdBooks } from "@/lib/openbd";
import type { UpstreamBook } from "@/lib/book-upstream";
import { ReportType, Medium } from "@/generated/prisma/client";

export type CreateReportResult = { id: string; error?: undefined } | { id?: undefined; error: string };

export async function createReport(input: ReportInput): Promise<CreateReportResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "認証が必要です" };
    }

    // 認証の直後に消費する。ここより後は書籍の upsert 等で DB に書き込みが発生するため、
    // 弾くならその手前で弾く
    const limit = await checkRateLimit(
      rateLimitKey("createReport", user.id),
      RATE_LIMITS.createReport
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    const parsed = ReportSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }
    const { book, edition, printing, title, type, medium, page, line,
            hasMultiplePages, locationNote, ebookLocation, wrong, correct, content, note,
            reportedErratumUrl } = parsed.data;

    // ISBN-13 に正規化（ISBN-10 は変換、不正な ISBN は弾く）
    const canonicalIsbn = toCanonicalIsbn(book.isbn);
    if (!canonicalIsbn) {
      return { error: "ISBNが正しくありません" };
    }

    const bookId = await findOrCreateBook(canonicalIsbn, book);

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        bookId,
        title,
        edition: edition ?? null,
        printing: printing ?? null,
        type: type as ReportType,
        medium: medium as Medium,
        page: page ?? null,
        line: line ?? null,
        hasMultiplePages: hasMultiplePages ?? false,
        locationNote: locationNote ?? null,
        ebookLocation: ebookLocation ?? null,
        wrong: wrong ?? null,
        correct: correct ?? null,
        content: content ?? null,
        note: note ?? null,
        // 申告 URL は公開しないが、保存時にもサニタイズしておく（不正な値を DB に入れない）
        reportedErratumUrl: sanitizeExternalUrl(reportedErratumUrl),
      },
    });

    // 画像は投稿の作成後にクライアントが別途アップロードするため id を返す
    return { id: report.id };
  } catch (error) {
    console.error(error);
    return { error: "投稿に失敗しました" };
  }
}

/**
 * 投稿先の書籍の行を返す。無ければ作る。
 *
 * ⭐ **書誌（書名・著者・出版社）はブラウザが送ってきた値を信じない。** 作るときはサーバーが
 * ISBN で OpenBD を引き直し、そちらを正とする。送られてきた値を使うのは OpenBD に無い項目だけ。
 * 理由: 書籍は最初に投稿した人の値で作られ、以後の投稿では更新しない。しかも
 * `Book.publisherId` は「誰がこの本の投稿に回答できるか」を決める（services/publisher-access.ts）。
 * 送られてきた値のままだと、フォームを通さずに送るだけで、実在する本を架空の出版社名で
 * 先に登録できてしまう＝本物の出版社の担当者が回答できなくなる。
 *
 * 合わせ方は画面の書誌補正（book-search.tsx の enrichWithOpenBD）と同じ＝OpenBD に値が
 * あればそれ、無ければ送られてきた値。書影は OpenBD がほぼ持たないので送られてきた値を先にする。
 *
 * ⚠️ 既にある書籍には触らない（書誌を直すのは管理者の書籍編集）。OpenBD を引くのも作るときだけ。
 */
async function findOrCreateBook(isbn: string, submitted: SubmittedBook): Promise<string> {
  const existing = await prisma.book.findUnique({ where: { isbn }, select: { id: true } });
  if (existing) return existing.id;

  const upstream = await lookupOpenBd(isbn);
  const title = upstream?.title || submitted.title;
  const author = upstream?.author || submitted.author || null;
  const publisherName = upstream?.publisher || submitted.publisher;

  // 出版社を名前で upsert（name は @unique — 同時投稿でも重複作成されない）
  let publisherId: string | null = null;
  if (publisherName) {
    const publisher = await prisma.publisher.upsert({
      where: { name: publisherName },
      update: {},
      create: { name: publisherName },
    });
    publisherId = publisher.id;
  }

  // 上で見つからなくても、同じ ISBN の同時投稿が先に作っていることがある。
  // ISBN を同一性の基準として upsert で名寄せする（@unique 制約により競合にも安全）
  const created = await prisma.book.upsert({
    where: { isbn },
    update: {},
    create: {
      title,
      author,
      isbn,
      // 許可ホスト（OpenBD / Google Books）以外は null に落とす。書影は装飾情報なので、
      // 提供元のホスト変更等があっても投稿自体は失敗させない（エラーにしない）。
      coverImageUrl:
        sanitizeCoverImageUrl(submitted.coverImageUrl) ??
        sanitizeCoverImageUrl(upstream?.coverImageUrl),
      publisherId,
    },
  });
  return created.id;
}

/**
 * OpenBD で1冊引く。**失敗したら null（＝送られてきた値で作る）に倒す。**
 * 上流が落ちている間に投稿そのものを失敗させるより、書誌を管理者が後から直せる形で
 * 受け付ける方が害が小さい（書籍編集 = admin/books）。
 */
async function lookupOpenBd(isbn: string): Promise<UpstreamBook | null> {
  try {
    const [found] = await fetchOpenBdBooks([isbn]);
    return found ?? null;
  } catch (error) {
    console.error("OpenBD の書誌取得に失敗（送られてきた値で書籍を作る）:", isbn, error);
    return null;
  }
}
