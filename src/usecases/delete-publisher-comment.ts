"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";

/**
 * 回答を削除する（運営者のモデレーションのみ＝規約 第10条1項）。
 *
 * ⚠️ **回答は書いた本人も取り消せない**（規約 第8条3項）。第三者が公開ページに書ける以上、
 *    不適切な回答1件のために投稿ごと消さずに済む手段が要る、というのがこの関数の存在理由
 *    （添付画像を1枚だけ消せるようにしたのと同じ考え方 = docs/moderation-policy.md）。
 */
export async function deletePublisherComment(commentId: string): Promise<{ error?: string }> {
  const admin = await requireAdminServerAction();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 監査ログの before に使う値なので、削除と同じ塊の中で読む
      const before = await tx.publisherComment.findUnique({
        where: { id: commentId },
        include: { publisher: { select: { name: true } } },
      });
      if (!before) return { error: "回答が見つかりません" };

      await tx.publisherComment.delete({ where: { id: commentId } });

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
