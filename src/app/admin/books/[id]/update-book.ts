"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { sanitizeExternalUrl } from "@/utils/external-url";
import { findBookForAuditLog, updateBook } from "@/features/book/db/books";
import { ensurePublisher } from "@/features/publisher/db/publishers";
import type { BookActionState } from "@/features/book/types";

// 管理者による書誌の手修正。ISBN は本の同一性の基準のため変更させない（読取専用）。
// 空の欄は「未設定」として保存される（null に倒すのは features/book/db/books.ts の updateBook）。
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
  // 公式の正誤表ページ（出版社とは限らない。著者本人が持っている本もある）。
  // 公開ページにリンクとして出るので、管理者だけが設定できる
  // （読者の申告は Report.reportedErratumUrl に入り、管理画面から採用する）。
  // ホストは出版社ごとに異なり許可リストを作れないため、リンクとして安全な形だけを強制する
  // （http も通す。理由は utils/external-url.ts。http のときは表示側で注記を出す）。
  erratumUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || sanitizeExternalUrl(v) !== null, {
      message: "正誤表のURLは http:// または https:// から始まる正しいURLを入力してください",
    }),
});

export type BookUpdateInput = z.input<typeof BookUpdateSchema>;

export async function updateBookAction(id: string, input: BookUpdateInput): Promise<BookActionState> {
  const admin = await requireAdminServerAction();

  const parsed = BookUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { publisherName, ...book } = parsed.data;

  let updated: boolean;
  try {
    // 書誌の更新と監査ログを1つのトランザクションにする（理由は features/report/actions/delete-report.ts の deleteReportAction）。
    // 出版社の用意も同じトランザクションに入れる: 更新が巻き戻るなら、そのために作った出版社も残さない。
    updated = await runInTransaction(async (tx) => {
      const before = await findBookForAuditLog(id, tx);
      if (!before) return false;

      // 出版社名が空なら紐付け無し（null）
      const publisherId = publisherName ? await ensurePublisher(publisherName, tx) : null;
      const after = await updateBook(id, { ...book, publisherId }, tx);

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_BOOK,
          targetType: TARGET_TYPE.BOOK,
          targetId: id,
          before: before as Record<string, unknown>,
          after: after as Record<string, unknown>,
        },
        tx
      );

      return true;
    });
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }

  if (!updated) {
    return { error: "書籍が見つかりません" };
  }

  // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
  refresh();
  return {};
}
