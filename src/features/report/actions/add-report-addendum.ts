"use server";

import { runInTransaction } from "@/services/transaction";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { AddendumSchema, type AddendumInput } from "@/features/report/schema";
import { formatJstDateTime } from "@/utils/format";
import { createReportAddendum, findReportOwnerAndStatus } from "@/features/report/db/reports";

// images は**作った直後は必ず空**（画像は追記を作ってから別リクエストで送るため）。
// 呼び出し側が送り終えた分を自分の一覧に足す = features/report/components/report-addenda.tsx
export type Addendum = {
  id: string;
  body: string;
  createdAt: string;
  images: { id: string; imageUrl: string }[];
};

type AddendumResult = { addendum: Addendum; error?: undefined } | { addendum?: undefined; error: string };

// ⚠️ **refresh() しない。作った行を返し、呼び出し側が自分の一覧に足す。**
//    理由は features/report/components/report-addenda.tsx のコメント。
export async function addReportAddendumAction(id: string, input: AddendumInput): Promise<AddendumResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  try {
    const parsed = AddendumSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    // 追記そのものは軽いが、1件ごとに画像の枠を消費できるので回数を抑える
    const limit = await checkRateLimit(
      rateLimitKey("addReportAddendum", user.id),
      RATE_LIMITS.addReportAddendum
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    const result = await runInTransaction(async (tx) => {
      const report = await findReportOwnerAndStatus(id, tx);
      if (!report) return { error: "投稿が見つかりません" };
      if (report.userId !== user.id) return { error: "この投稿に追記する権限がありません" };
      // PENDING のうちは本文を直せるので追記させない（同じことを2つの経路で言えるようにしない）
      if (report.status === "PENDING") {
        return { error: "この投稿はまだ編集できます。本文を直してください。" };
      }

      const created = await createReportAddendum(id, parsed.data.body, tx);
      return {
        addendum: {
          id: created.id,
          body: created.body,
          createdAt: formatJstDateTime(created.createdAt),
          images: [],
        },
      };
    });
    return result;
  } catch (error) {
    console.error(error);
    return { error: "追記に失敗しました" };
  }
}
