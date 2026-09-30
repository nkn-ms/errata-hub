"use server";

import { refresh } from "next/cache";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { ReportActionState } from "@/features/report/types";
import {
  deleteReportAddendum,
  findReportAddendumForDeletion,
  removeImageFiles,
} from "@/features/report/db/report-deletion";

/**
 * 追記を1件削除する（管理者のみ）。
 *
 * 動機は権利侵害の申し立てへの対応。追記の本文に侵害物が書かれたとき、これが無いと
 * **投稿ごと消すしかない**（無関係な投稿者の指摘まで巻き添えになる）。
 * 画像1枚だけを消す deleteReportImageAction と同じ系統の措置。
 *
 * ⚠️ **投稿者は消せない。** 追記は「連絡後は本文を直さず足す」ための仕組みで、
 *    消せると出版社が見た内容を後から変えられる（= decision-report-edit-window）。
 *
 * ⚠️ **添えた画像の実体は Cascade では消えない。** ReportImage は addendumId の Cascade で
 *    行だけ消えるので、Storage のファイルが残る。先に URL を集めてからコミット後に消す。
 */
export async function deleteReportAddendumAction(addendumId: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let deleted: { reportId: string; imageUrls: string[] } | null = null;
  try {
    deleted = await runInTransaction(async (tx) => {
      const found = await findReportAddendumForDeletion(addendumId, tx);
      if (!found) return null;

      await deleteReportAddendum(addendumId, tx);
      // 対象は投稿（追記は投稿の一部）なので targetId は reportId にし、消した中身を before に残す。
      // ⚠️ ここが孤児ファイルを後から辿る唯一の手掛かりになる（removeImageFiles のコメント）。
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT_ADDENDUM,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: found as unknown as Record<string, unknown>,
        },
        tx
      );
      return { reportId: found.reportId, imageUrls: found.images.map((image) => image.imageUrl) };
    });
  } catch (error) {
    console.error(error);
    return { error: "追記の削除に失敗しました" };
  }

  if (!deleted) {
    return { error: "追記が見つかりません" };
  }

  await removeImageFiles(deleted.imageUrls);

  refresh();
  return {};
}
