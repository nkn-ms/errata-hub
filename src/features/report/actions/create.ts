"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalIsbn } from "@/utils/isbn";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { sanitizeExternalUrl } from "@/utils/external-url";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { ReportSchema, type ReportInput } from "@/features/report/schema";
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

    // 出版社を名前で upsert（name は @unique — 同時投稿でも重複作成されない）
    let publisherId: string | null = null;
    if (book.publisher) {
      const publisher = await prisma.publisher.upsert({
        where: { name: book.publisher },
        update: {},
        create: { name: book.publisher },
      });
      publisherId = publisher.id;
    }

    // ISBN を同一性の基準として upsert で名寄せ（@unique 制約により競合にも安全）
    const bookRecord = await prisma.book.upsert({
      where: { isbn: canonicalIsbn },
      update: {},
      create: {
        title: book.title,
        author: book.author || null,
        isbn: canonicalIsbn,
        // 許可ホスト（OpenBD / Google Books）以外は null に落とす。書影は装飾情報なので、
        // 提供元のホスト変更等があっても投稿自体は失敗させない（エラーにしない）。
        coverImageUrl: sanitizeCoverImageUrl(book.coverImageUrl),
        publisherId,
      },
    });

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        bookId: bookRecord.id,
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
