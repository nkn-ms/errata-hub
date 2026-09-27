"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { ReportActionState } from "@/features/report/types";
import { removeImageFiles } from "@/features/report/db/report-deletion";

/**
 * 添付画像を1枚だけ削除する（管理者のみ）。
 *
 * 動機は権利者対応の実効性。「この画像だけ消してほしい」と言われたとき、これが無いと
 * 投稿ごと消すか Supabase の管理画面で行とファイルを手作業で消すしかない
 * （docs/moderation-policy.md の「部分マスキング」と同じ系統の措置）。
 *
 * 投稿本文には触れない＝**投稿を消さずに済ませる**ための手段であることが要点。
 */
export async function deleteReportImage(imageId: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let image: Awaited<ReturnType<typeof prisma.reportImage.findUnique>>;
  try {
    // deleteReport と同じ形: 行の削除と監査ログを1つの塊にする。
    // ⚠️ 権利者からの削除要請に応じた証跡なので、**記録が残せないなら削除も成立させない**方が正しい。
    // 「記録だけが無い」状態を作らないことが目的で、同じ DB であることは条件にすぎない。
    image = await prisma.$transaction(async (tx) => {
      const found = await tx.reportImage.findUnique({ where: { id: imageId } });
      if (!found) return null;

      await tx.reportImage.delete({ where: { id: imageId } });
      // 対象は投稿（画像は投稿の一部）なので targetId は reportId にし、消した画像を before に残す。
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT_IMAGE,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "画像の削除に失敗しました" };
  }

  if (!image) {
    return { error: "画像が見つかりません" };
  }

  await removeImageFiles([image.imageUrl]);

  refresh();
  return {};
}
