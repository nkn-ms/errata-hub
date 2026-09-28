"use server";

import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { addUpvote, countUpvotes, findReportOwnerAndStatus, removeUpvote } from "@/features/report/db/reports";

export type UpvoteResult = { upvoted: boolean; count: number; error?: undefined } | { error: string };

/**
 * 賛同を付ける / 取り消す。自分の投稿には不可。
 * 付与の重複も取り消しの空振りも、成功として扱う（冪等＝features/report/db/reports.ts の addUpvote・removeUpvote）。
 */
export async function toggleUpvoteUsecase(reportId: string, upvote: boolean): Promise<UpvoteResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "認証が必要です" };
    }

    // 付与・取り消しのどちらも数える（連打は両方向に等しく発生するため）
    const limit = await checkRateLimit(
      rateLimitKey("toggleUpvote", user.id),
      RATE_LIMITS.toggleUpvote
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    if (upvote) {
      const report = await findReportOwnerAndStatus(reportId);
      if (!report) {
        return { error: "投稿が見つかりません" };
      }
      if (report.userId === user.id) {
        return { error: "自分の投稿には賛同できません" };
      }

      await addUpvote(reportId, user.id);
    } else {
      await removeUpvote(reportId, user.id);
    }

    return { upvoted: upvote, count: await countUpvotes(reportId) };
  } catch (error) {
    console.error(error);
    return { error: upvote ? "賛同に失敗しました" : "賛同の取り消しに失敗しました" };
  }
}

