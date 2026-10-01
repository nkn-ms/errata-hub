"use server";

import { redirect } from "next/navigation";
import { runInTransaction } from "@/services/transaction";
import { requireAdminServerAction } from "@/services/auth";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { routes } from "@/constants/routes";
import type { PublisherState } from "@/features/publisher/types";
import { parsePublisherForm } from "@/features/publisher/schema";
import { createPublisher, toMessage } from "@/features/publisher/db/publishers";

export async function createPublisherAction(
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  const admin = await requireAdminServerAction();

  const parsed = parsePublisherForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    // 作成と監査ログを1つのトランザクションにする（理由は features/report/actions/delete-report.ts の deleteReportAction）。
    await runInTransaction(async (tx) => {
      const publisher = await createPublisher(parsed.data, tx);

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.CREATE_PUBLISHER,
          targetType: TARGET_TYPE.PUBLISHER,
          targetId: publisher.id,
          after: publisher as unknown as Record<string, unknown>,
        },
        tx
      );
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の登録に失敗しました") };
  }

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.publishers);
}
