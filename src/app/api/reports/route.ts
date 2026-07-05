import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalIsbn } from "@/utils/isbn";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { ReportType, Medium } from "@/generated/prisma/client";

// ISBN を本の同一性の基準にする方針のため isbn は必須。
// 形式の正規化・検証は toCanonicalIsbn（ISBN-13 へ統一）で行う。
const BookSchema = z.object({
  googleBooksId: z.string().optional(),
  title: z.string().min(1, "書籍名は必須です"),
  author: z.string().optional(),
  publisher: z.string().optional(),
  isbn: z.string().min(1, "ISBNは必須です"),
  coverImageUrl: z.string().optional(),
});

const ReportSchema = z.object({
  book: BookSchema,
  edition: z.number().int().positive().nullable().optional(),
  printing: z.number().int().positive().nullable().optional(),
  title: z.string().min(1, "タイトルは必須です"),
  type: z.enum(["ERRATA", "SUGGESTION", "OTHER"]),
  medium: z.enum(["PAPER", "EBOOK", "OTHER"]),
  page: z.number().int().positive().nullable().optional(),
  line: z.number().int().positive().nullable().optional(),
  hasMultiplePages: z.boolean().optional(),
  locationNote: z.string().nullable().optional(),
  ebookLocation: z.string().nullable().optional(),
  wrong: z.string().nullable().optional(),
  correct: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  // 種別・媒体ごとの条件付き必須。UI と同じ条件をサーバーでも強制する（API 直叩き対策）。
  if (data.type === "ERRATA") {
    if (!data.wrong?.trim()) {
      ctx.addIssue({ code: "custom", path: ["wrong"], message: "誤（該当箇所）は必須です" });
    }
    if (!data.correct?.trim()) {
      ctx.addIssue({ code: "custom", path: ["correct"], message: "正（正しい内容）は必須です" });
    }
  } else if (!data.content?.trim()) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "内容・提案は必須です" });
  }
  if (data.medium === "PAPER" && data.edition == null) {
    ctx.addIssue({ code: "custom", path: ["edition"], message: "版は必須です" });
  }
  if (data.medium === "PAPER" && data.page == null) {
    ctx.addIssue({ code: "custom", path: ["page"], message: "ページ番号は必須です" });
  }
  if (data.medium === "EBOOK" && !data.ebookLocation?.trim()) {
    ctx.addIssue({ code: "custom", path: ["ebookLocation"], message: "位置は必須です" });
  }
  if (data.medium === "OTHER" && !data.locationNote?.trim()) {
    ctx.addIssue({ code: "custom", path: ["locationNote"], message: "位置メモは必須です" });
  }
});

// 一覧取得はサーバーコンポーネントから services/report の findRecentReports を直接呼ぶため、
// ここに GET（HTTP 越しの自前 API）は置かない。

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力内容が不正です", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { book, edition, printing, title, type, medium, page, line,
            hasMultiplePages, locationNote, ebookLocation, wrong, correct, content, note } = parsed.data;

    // ISBN-13 に正規化（ISBN-10 は変換、不正な ISBN は弾く）
    const canonicalIsbn = toCanonicalIsbn(book.isbn);
    if (!canonicalIsbn) {
      return NextResponse.json({ error: "ISBNが正しくありません" }, { status: 400 });
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
        // 提供元のホスト変更等があっても投稿自体は失敗させない（400 にしない）。
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
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}
