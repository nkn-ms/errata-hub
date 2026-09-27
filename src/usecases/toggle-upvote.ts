"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";

export type UpvoteResult = { upvoted: boolean; count: number; error?: undefined } | { error: string };

function countUpvotes(reportId: string) {
  return prisma.upvote.count({ where: { reportId } });
}

/**
 * 賛同を付ける / 取り消す。自分の投稿には不可。
 * 付与の重複は @@unique 制約で、取り消しの空振りは deleteMany で、どちらも冪等に扱う。
 */
export async function toggleUpvote(reportId: string, upvote: boolean): Promise<UpvoteResult> {
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
      const report = await prisma.report.findUnique({ where: { id: reportId }, select: { userId: true } });
      if (!report) {
        return { error: "投稿が見つかりません" };
      }
      if (report.userId === user.id) {
        return { error: "自分の投稿には賛同できません" };
      }

      try {
        await prisma.upvote.create({ data: { reportId, profileId: user.id } });
      } catch (e) {
        // P2002 = unique 制約違反（すでに賛同済み）。二重クリック等を想定し成功扱いにする。
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    } else {
      await prisma.upvote.deleteMany({ where: { reportId, profileId: user.id } });
    }

    return { upvoted: upvote, count: await countUpvotes(reportId) };
  } catch (error) {
    console.error(error);
    return { error: upvote ? "賛同に失敗しました" : "賛同の取り消しに失敗しました" };
  }
}

