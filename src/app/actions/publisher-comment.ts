"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { checkPublisherCommentPermission } from "@/services/publisher-access";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";
import { formatJstDateTime } from "@/utils/format";
import type { PublisherCommentView } from "@/types/report";

const PublisherCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .max(
      REPORT_LIMITS.publisherComment,
      `回答は${REPORT_LIMITS.publisherComment}文字以内で入力してください`
    )
    .min(1, "回答を入力してください"),
});
export type PublisherCommentInput = z.input<typeof PublisherCommentSchema>;

type AddResult =
  | { comment: PublisherCommentView; error?: undefined }
  | { comment?: undefined; error: string };

/**
 * 出版社として回答する（規約 第8条）。書けるのは対象書籍の出版社の権限を持つ人と、
 * 代理記載を行う管理者（判定は services/publisher-access.ts）。
 *
 * ⚠️ **refresh() しない。作った行を返し、呼び出し側が自分の一覧に足す。**
 *    理由は components/report-addenda.tsx のコメント（再描画が入力欄ごと差し替えて書きかけを失う）。
 */
export async function addPublisherComment(
  reportId: string,
  input: PublisherCommentInput
): Promise<AddResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  try {
    const parsed = PublisherCommentSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const limit = await checkRateLimit(
      rateLimitKey("addPublisherComment", user.id),
      RATE_LIMITS.addPublisherComment
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    // 判定を塊の中で行う理由は checkPublisherCommentPermission のコメント
    return await prisma.$transaction(async (tx): Promise<AddResult> => {
      const permission = await checkPublisherCommentPermission(user.id, reportId, tx);
      if (permission.error !== undefined) {
        return { error: permission.error };
      }

      const created = await tx.publisherComment.create({
        data: {
          reportId,
          publisherId: permission.publisherId,
          body: parsed.data.body,
          authorId: user.id,
          byAdmin: permission.byAdmin,
        },
        include: { publisher: { select: { name: true } } },
      });

      return {
        comment: {
          id: created.id,
          publisherName: created.publisher.name,
          body: created.body,
          byAdmin: created.byAdmin,
          createdAt: formatJstDateTime(created.createdAt),
        },
      };
    });
  } catch (error) {
    console.error(error);
    return { error: "回答の投稿に失敗しました" };
  }
}

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
