"use server";

import { refresh } from "next/cache";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { deletePublisherComment, findPublisherCommentForDeletion } from "@/features/report/db/report-deletion";

/**
 * 回答を削除する（運営者のモデレーションのみ＝規約 第10条1項）。
 *
 * ⚠️ **回答は書いた本人も取り消せない**（規約 第8条3項）。第三者が公開ページに書ける以上、
 *    不適切な回答1件のために投稿ごと消さずに済む手段が要る、というのがこの関数の存在理由
 *    （添付画像を1枚だけ消せるようにしたのと同じ考え方 = docs/moderation-policy.md）。
 */
export async function deletePublisherCommentAction(commentId: string): Promise<{ error?: string }> {
  const admin = await requireAdminServerAction();

  try {
    const result = await runInTransaction(async (tx) => {
      // 監査ログの before に使う値なので、削除と同じトランザクションの中で読む
      const before = await findPublisherCommentForDeletion(commentId, tx);
      if (!before) return { error: "回答が見つかりません" };

      await deletePublisherComment(commentId, tx);

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_PUBLISHER_COMMENT,
          targetType: TARGET_TYPE.PUBLISHER_COMMENT,
          targetId: commentId,
          // 行ごと消えるので、記録には当時の値をそのまま残す（出版社名は id でなく名前で。
          // 90日で消える AuditLog から後で引き直せないため = #197 で決めた原則）
          before: {
            reportId: before.reportId,
            publisherName: before.publisher.name,
            body: before.body,
            byAdmin: before.byAdmin,
            createdAt: before.createdAt.toISOString(),
          },
          after: null,
        },
        tx
      );

      return {};
    });

    if (result.error !== undefined) return result;

    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "回答の削除に失敗しました" };
  }
}
