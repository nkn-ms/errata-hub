"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import type { ReportActionState } from "@/features/report/types";
import { Prisma } from "@/generated/prisma/client";
import {
  ReportUpdateSchema,
  ReportBodySchema,
  AddendumSchema,
  type ReportUpdateInput,
  type ReportBodyInput,
  type AddendumInput,
} from "@/features/report/schema";
import { formatJstDateTime } from "@/utils/format";

export async function updateReport(id: string, input: ReportUpdateInput): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = ReportUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.report.findUnique({ where: { id } });
      const report = await tx.report.update({
        where: { id },
        data: parsed.data,
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          // ReportUpdateSchema が受ける4項目すべてを記録する（fixedEdition/fixedPrinting は FIXED 運用の要）
          before: {
            status: before?.status,
            statusNote: before?.statusNote,
            fixedEdition: before?.fixedEdition,
            fixedPrinting: before?.fixedPrinting,
          },
          after: {
            status: report.status,
            statusNote: report.statusNote,
            fixedEdition: report.fixedEdition,
            fixedPrinting: report.fixedPrinting,
          },
        },
        tx
      );
    });

    // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

// 認可の3つ目の形態（「ログイン済み かつ その投稿の投稿者」）なので services/auth は使わない。
// ステータスは一本道なので「FORWARDED 未満」は PENDING で足りる。DISMISSED も弾く。
//
// ⚠️ ステータスの確認はトランザクションの**中**で行う。編集画面を開いている間に管理者が
//    連絡済みにする競合は現実にあり、画面を出した時点の判定では送信済みの投稿を書き換えられる。
export async function updateOwnReport(id: string, input: ReportBodyInput): Promise<ReportActionState> {
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

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.report.findUnique({ where: { id } });
      if (!before) return { error: "投稿が見つかりません" };
      if (before.userId !== user.id) return { error: "この投稿を編集する権限がありません" };
      if (before.status !== "PENDING") {
        return { error: "連絡済みの投稿は編集できません。追記でご対応ください。" };
      }

      // editedAt は投稿者が本文を触ったときだけ動かす（updatedAt は管理者の操作でも動くため）
      const after = await tx.report.update({
        where: { id },
        data: { ...parsed.data, editedAt: new Date() },
      });

      // 上書きなので他に痕跡が残らない。賛同が付いた後の書き換えを辿れる唯一の手段
      // （本人の操作を載せる前例は withdraw にもある）
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

// images は**作った直後は必ず空**（画像は追記を作ってから別リクエストで送るため）。
// 呼び出し側が送り終えた分を自分の一覧に足す = components/report-addenda.tsx
export type Addendum = {
  id: string;
  body: string;
  createdAt: string;
  images: { id: string; imageUrl: string }[];
};
type AddendumResult = { addendum: Addendum; error?: undefined } | { addendum?: undefined; error: string };

// ⚠️ **refresh() しない。作った行を返し、呼び出し側が自分の一覧に足す。**
//    理由は components/report-addenda.tsx のコメント。
export async function addReportAddendum(id: string, input: AddendumInput): Promise<AddendumResult> {
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

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) return { error: "投稿が見つかりません" };
      if (report.userId !== user.id) return { error: "この投稿に追記する権限がありません" };
      // PENDING のうちは本文を直せるので追記させない（同じことを2つの経路で言えるようにしない）
      if (report.status === "PENDING") {
        return { error: "この投稿はまだ編集できます。本文を直してください。" };
      }

      const created = await tx.reportAddendum.create({
        data: { reportId: id, body: parsed.data.body },
      });
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
