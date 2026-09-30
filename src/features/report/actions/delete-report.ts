"use server";

import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { ReportActionState } from "@/features/report/types";
import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";
import { deleteReport, findReportForDeletion, removeImageFiles } from "@/features/report/db/report-deletion";

export async function deleteReportAction(id: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let report: Awaited<ReturnType<typeof findReportForDeletion>>;
  try {
    // トランザクションにする理由は「操作は成立したのに記録だけが無い」状態を作らないため。
    // 分けると「投稿は消えたが記録が無い」半端な状態が残り、しかも監査ログの失敗で
    // catch に入るため画面には「削除に失敗しました」と出る（実際は消えている）。
    // トランザクションにすれば、記録が残せないときは削除ごと巻き戻るので、その文言が事実になる。
    // （投稿と監査ログが同じ DB にあることは、この手段を使える条件であって理由ではない。
    //   外部サービスをまたぐ操作は包めないので、別途「どちらに倒すか」を決める＝ features/report/db/report-deletion.ts の removeImageFiles）
    //
    // ⚠️ トランザクションの中では tx を使うこと。グローバルの prisma を使うと別接続になりトランザクションの外に出る。
    report = await runInTransaction(async (tx) => {
      const found = await findReportForDeletion(id, tx);
      if (!found) return null;

      await deleteReport(id, tx);
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }

  if (!report) {
    return { error: "投稿が見つかりません" };
  }

  await removeImageFiles(report.images.map((image) => image.imageUrl));

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.reports);
}
