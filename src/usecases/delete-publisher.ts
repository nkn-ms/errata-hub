"use server";

import { redirect } from "next/navigation";
import { runInTransaction } from "@/services/transaction";
import { requireAdminServerAction } from "@/services/auth";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { routes } from "@/constants/routes";
import type { PublisherState } from "@/features/publisher/types";
import { countBooksByPublisher, deletePublisher, toMessage } from "@/features/publisher/db/publishers";

export async function deletePublisherUsecase(id: string): Promise<PublisherState> {
  const admin = await requireAdminServerAction();

  // 書籍が紐づく出版社は削除させない（UX側のガード）。
  // 件数を文言に出すための早期チェックで、トランザクションの外に置いてよい: 隙間で書籍が増えても
  // DB の onDelete: Restrict（Book.publisherId）が最終的に削除を拒むため。
  const bookCount = await countBooksByPublisher(id);
  if (bookCount > 0) {
    return {
      error: `この出版社には${bookCount}冊の書籍が紐づいているため削除できません。先に書籍の出版社を付け替えてください。`,
    };
  }

  try {
    // 削除と監査ログを1つのトランザクションにする（理由は usecases/delete-report.ts の deleteReportUsecase）。
    // 行が消えると他に痕跡が無いので、記録が残せないなら削除も成立させない。
    await runInTransaction(async (tx) => {
      // 対象が無ければ delete が P2025 を投げ、toMessage が「対象の出版社が見つかりません」に訳す
      const publisher = await deletePublisher(id, tx);

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_PUBLISHER,
          targetType: TARGET_TYPE.PUBLISHER,
          targetId: id,
          before: publisher as unknown as Record<string, unknown>,
        },
        tx
      );
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の削除に失敗しました") };
  }

  redirect(routes.admin.publishers);
}
