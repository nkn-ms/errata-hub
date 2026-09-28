"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminServerAction } from "@/services/auth";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { routes } from "@/constants/routes";
import type { PublisherState } from "@/features/publisher/types";
import { parsePublisherForm } from "@/features/publisher/schema";
import { toMessage } from "@/features/publisher/db/publishers";

export async function createPublisherUsecase(
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  const admin = await requireAdminServerAction();

  const parsed = parsePublisherForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, emailDomain, note } = parsed.data;

  try {
    // 作成と監査ログを1つのトランザクションにする（理由は usecases/delete-report.ts の deleteReportUsecase）。
    await prisma.$transaction(async (tx) => {
      const publisher = await tx.publisher.create({
        data: {
          name,
          email: email || null,
          emailDomain: emailDomain || null,
          note: note || null,
        },
      });

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
