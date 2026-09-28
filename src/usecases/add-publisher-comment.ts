"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { checkPublisherCommentPermission } from "@/services/publisher-access";
import { REPORT_LIMITS } from "@/features/report/constants/report-limits";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { formatJstDateTime } from "@/utils/format";
import type { PublisherCommentView } from "@/features/report/types";

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
 *    理由は features/report/components/report-addenda.tsx のコメント（再描画が入力欄ごと差し替えて書きかけを失う）。
 */
export async function addPublisherCommentUsecase(
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

    // 追記（addReportAddendumUsecase）と同じ形。⚠️ 書き込みは1本なので原子性のためではない。
    // 判定を送信のたびにやり直すのが目的で、**競合は閉じていない**（READ COMMITTED なので、
    // 判定と INSERT の間に権限を剥奪されても気づかない）＝理由は checkPublisherCommentPermission
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
