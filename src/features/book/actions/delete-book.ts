"use server";

import { redirect } from "next/navigation";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { routes } from "@/constants/routes";
import { countReportsByBook, deleteBook, findBookForAuditLog } from "@/features/book/db/books";
import type { BookActionState } from "@/features/book/types";

export async function deleteBookAction(id: string): Promise<BookActionState> {
  const admin = await requireAdminServerAction();

  // 投稿が紐づく本は削除させない（出版社削除ガードと同じ「子があれば不可」の方針）。
  // 件数を文言に出すための早期チェックで、トランザクションの外に置いてよい: 隙間で投稿が増えても
  // DB 側の Restrict（Report.bookId は必須リレーション）が最終的に削除を拒むため。
  const reportCount = await countReportsByBook(id);
  if (reportCount > 0) {
    return { error: `${reportCount}件の投稿が紐づいているため削除できません。先に投稿を削除してください。` };
  }

  let deleted: boolean;
  try {
    // 削除と監査ログを1つのトランザクションにする（理由は features/report/actions/delete-report.ts の deleteReportAction）。
    // 行が消えると他に痕跡が無いので、記録が残せないなら削除も成立させない。
    deleted = await runInTransaction(async (tx) => {
      const book = await findBookForAuditLog(id, tx);
      if (!book) return false;

      await deleteBook(id, tx);

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_BOOK,
          targetType: TARGET_TYPE.BOOK,
          targetId: id,
          before: book as Record<string, unknown>,
        },
        tx
      );

      return true;
    });
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }

  if (!deleted) {
    return { error: "書籍が見つかりません" };
  }

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.books);
}
