import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdmin } from "@/services/auth";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";

// 管理者による書誌の手修正。ISBN は本の同一性の基準のため変更させない（読取専用）。
// 空文字は「未設定」とみなして null に倒す。
// 書影URLは許可ホスト（OpenBD / Google Books）のみ。手入力ミスに気づけるよう、
// 投稿API（黙って null に落とす）と違いここでは 400 で明示的に弾く。
const BookUpdateSchema = z.object({
  title: z.string().trim().min(1, "書籍名は必須です"),
  author: z.string().trim().optional(),
  publisherName: z.string().trim().optional(),
  coverImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || sanitizeCoverImageUrl(v) !== null, {
      message: "書影URLは OpenBD / Google Books 由来（cover.openbd.jp・books.google.com・books.googleusercontent.com）のURLのみ設定できます",
    }),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, error } = await requireAdmin();
    if (error) return error;

    const book = await prisma.book.findUnique({ where: { id }, include: { publisher: true } });
    if (!book) {
      return NextResponse.json({ error: "書籍が見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = BookUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力内容が不正です", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { title, author, publisherName, coverImageUrl } = parsed.data;

    // 出版社は名前で upsert（api/reports/route.ts と同型）。findFirst→create の2段だと
    // 同時実行の隙間で name @unique に衝突（P2002→500）し得るため、1命令で競合安全にする。
    // 空なら紐付け無し（null）。
    let publisherId: string | null = null;
    if (publisherName) {
      const publisher = await prisma.publisher.upsert({
        where: { name: publisherName },
        update: {},
        create: { name: publisherName },
      });
      publisherId = publisher.id;
    }

    const updated = await prisma.book.update({
      where: { id },
      data: {
        title,
        author: author || null,
        coverImageUrl: sanitizeCoverImageUrl(coverImageUrl),
        publisherId,
      },
      include: { publisher: true },
    });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE_BOOK",
      targetType: TARGET_TYPE.BOOK,
      targetId: id,
      before: book as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, error } = await requireAdmin();
    if (error) return error;

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "書籍が見つかりません" }, { status: 404 });
    }

    // 投稿が紐づく本は削除させない（出版社削除ガードと同じ「子があれば不可」の方針）。
    // DB 側でも Report.bookId は必須リレーション=Restrict なので二重に守られる。
    const reportCount = await prisma.report.count({ where: { bookId: id } });
    if (reportCount > 0) {
      return NextResponse.json(
        { error: `${reportCount}件の投稿が紐づいているため削除できません。先に投稿を削除してください。` },
        { status: 409 }
      );
    }

    await prisma.book.delete({ where: { id } });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "DELETE_BOOK",
      targetType: TARGET_TYPE.BOOK,
      targetId: id,
      before: book as Record<string, unknown>,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
