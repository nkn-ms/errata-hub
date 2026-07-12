"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdminOrThrow } from "@/services/auth";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { routes } from "@/constants/routes";

// 管理者による書誌の手修正。ISBN は本の同一性の基準のため変更させない（読取専用）。
// 空文字は「未設定」とみなして null に倒す。
// 書影URLは許可ホスト（OpenBD / Google Books）のみ。手入力ミスに気づけるよう、
// 投稿アクション（黙って null に落とす）と違いここでは明示的にエラーで弾く。
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

export type BookUpdateInput = z.input<typeof BookUpdateSchema>;
export type BookActionState = { error?: string };

export async function updateBook(id: string, input: BookUpdateInput): Promise<BookActionState> {
  const admin = await requireAdminOrThrow();

  try {
    const book = await prisma.book.findUnique({ where: { id }, include: { publisher: true } });
    if (!book) {
      return { error: "書籍が見つかりません" };
    }

    const parsed = BookUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }
    const { title, author, publisherName, coverImageUrl } = parsed.data;

    // 出版社は名前で upsert（actions/report.ts と同型）。findFirst→create の2段だと
    // 同時実行の隙間で name @unique に衝突（P2002→失敗）し得るため、1命令で競合安全にする。
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
      userId: admin.id,
      userEmail: admin.email,
      action: "UPDATE_BOOK",
      targetType: TARGET_TYPE.BOOK,
      targetId: id,
      before: book as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

export async function deleteBook(id: string): Promise<BookActionState> {
  const admin = await requireAdminOrThrow();

  try {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return { error: "書籍が見つかりません" };
    }

    // 投稿が紐づく本は削除させない（出版社削除ガードと同じ「子があれば不可」の方針）。
    // DB 側でも Report.bookId は必須リレーション=Restrict なので二重に守られる。
    const reportCount = await prisma.report.count({ where: { bookId: id } });
    if (reportCount > 0) {
      return { error: `${reportCount}件の投稿が紐づいているため削除できません。先に投稿を削除してください。` };
    }

    await prisma.book.delete({ where: { id } });

    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "DELETE_BOOK",
      targetType: TARGET_TYPE.BOOK,
      targetId: id,
      before: book as Record<string, unknown>,
    });
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.books);
}
