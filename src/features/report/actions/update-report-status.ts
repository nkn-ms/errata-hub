"use server";

import { refresh } from "next/cache";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { ReportActionState } from "@/features/report/types";
import { ReportUpdateSchema, type ReportUpdateInput } from "@/features/report/schema";
import { findReportForAuditLog } from "@/features/report/db/reports";
import { updateReportStatus } from "@/features/report/db/reports-admin";

export async function updateReportStatusAction(id: string, input: ReportUpdateInput): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = ReportUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    await runInTransaction(async (tx) => {
      const before = await findReportForAuditLog(id, tx);
      const report = await updateReportStatus(id, parsed.data, tx);

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
