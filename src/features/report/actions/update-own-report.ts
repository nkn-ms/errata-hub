"use server";

import { refresh } from "next/cache";
import { runInTransaction } from "@/services/transaction";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import type { ReportActionState } from "@/features/report/types";
import type { Prisma } from "@/generated/prisma/client";
import { ReportBodySchema, type ReportBodyInput } from "@/features/report/schema";
import { findReportForAuditLog, updateReportBody } from "@/features/report/db/reports";

// 認可の3つ目の形態（「ログイン済み かつ その投稿の投稿者」）なので services/auth は使わない。
// ステータスは一本道なので「FORWARDED 未満」は PENDING で足りる。DISMISSED も弾く。
//
// ⚠️ ステータスの確認はトランザクションの**中**で行う。編集画面を開いている間に管理者が
//    連絡済みにする競合は現実にあり、画面を出した時点の判定では送信済みの投稿を書き換えられる。
export async function updateOwnReportAction(id: string, input: ReportBodyInput): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  try {
    const parsed = ReportBodySchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const result = await runInTransaction(async (tx) => {
      const before = await findReportForAuditLog(id, tx);
      if (!before) return { error: "投稿が見つかりません" };
      if (before.userId !== user.id) return { error: "この投稿を編集する権限がありません" };
      if (before.status !== "PENDING") {
        return { error: "連絡済みの投稿は編集できません。追記でご対応ください。" };
      }

      const after = await updateReportBody(id, parsed.data, tx);

      // 上書きなので他に痕跡が残らない。賛同が付いた後の書き換えを辿れる唯一の手段
      // （本人の操作を載せる前例は withdrawAccountAction にもある）
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.UPDATE_OWN_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: toAuditBody(before),
          after: toAuditBody(after),
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
    return { error: "更新に失敗しました" };
  }
}

function toAuditBody(report: Prisma.ReportGetPayload<object>) {
  return {
    title: report.title,
    type: report.type,
    medium: report.medium,
    edition: report.edition,
    printing: report.printing,
    page: report.page,
    line: report.line,
    hasMultiplePages: report.hasMultiplePages,
    locationNote: report.locationNote,
    ebookLocation: report.ebookLocation,
    wrong: report.wrong,
    correct: report.correct,
    content: report.content,
    note: report.note,
  };
}
