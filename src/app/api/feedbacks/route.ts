import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { toCanonicalIsbn } from "@/utils/isbn";
import { FeedbackType, LocationType } from "@/generated/prisma/client";

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

const FeedbackSchema = z.object({
  book: BookSchema,
  edition: z.number().int().positive().nullable().optional(),
  printing: z.number().int().positive().nullable().optional(),
  title: z.string().min(1, "タイトルは必須です"),
  type: z.enum(["TYPO", "ERRATA", "READABILITY", "OTHER"]),
  locationType: z.enum(["PAGE", "KINDLE", "OTHER"]),
  page: z.number().int().positive().nullable().optional(),
  line: z.number().int().positive().nullable().optional(),
  hasMultiplePages: z.boolean().optional(),
  locationNote: z.string().nullable().optional(),
  kindleLocation: z.string().nullable().optional(),
  wrong: z.string().nullable().optional(),
  correct: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

// 一覧取得はサーバーコンポーネントから services/feedback の findRecentFeedbacks を直接呼ぶため、
// ここに GET（HTTP 越しの自前 API）は置かない。

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力内容が不正です", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { book, edition, printing, title, type, locationType, page, line,
            hasMultiplePages, locationNote, kindleLocation, wrong, correct, content, note } = parsed.data;

    // ISBN-13 に正規化（ISBN-10 は変換、不正な ISBN は弾く）
    const canonicalIsbn = toCanonicalIsbn(book.isbn);
    if (!canonicalIsbn) {
      return NextResponse.json({ error: "ISBNが正しくありません" }, { status: 400 });
    }

    // 出版社を検索または作成（無ければ作る）
    let publisherId: string | null = null;
    if (book.publisher) {
      const publisher =
        (await prisma.publisher.findFirst({ where: { name: book.publisher } })) ??
        (await prisma.publisher.create({ data: { name: book.publisher } }));
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
        coverImageUrl: book.coverImageUrl || null,
        publisherId,
      },
    });

    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        bookId: bookRecord.id,
        title,
        edition: edition ?? null,
        printing: printing ?? null,
        type: type as FeedbackType,
        locationType: locationType as LocationType,
        page: page ?? null,
        line: line ?? null,
        hasMultiplePages: hasMultiplePages ?? false,
        locationNote: locationNote ?? null,
        kindleLocation: kindleLocation ?? null,
        wrong: wrong ?? null,
        correct: correct ?? null,
        content: content ?? null,
        note: note ?? null,
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
}
