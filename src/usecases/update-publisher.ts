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

export async function updatePublisherUsecase(
  id: string,
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
    // 更新と監査ログを1つのトランザクションにする（理由は usecases/delete-report.ts の deleteReportUsecase）。
    await prisma.$transaction(async (tx) => {
      const before = await tx.publisher.findUnique({ where: { id } });
      const publisher = await tx.publisher.update({
        where: { id },
        data: {
          name,
          email: email || null,
          emailDomain: emailDomain || null,
          note: note || null,
        },
      });

      // 「誰が連絡先やメモを書き換えたか」を後から説明できるよう、変更前後を残す
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_PUBLISHER,
          targetType: TARGET_TYPE.PUBLISHER,
          targetId: id,
          before: (before ?? null) as unknown as Record<string, unknown> | null,
          after: publisher as unknown as Record<string, unknown>,
        },
        tx
      );
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の更新に失敗しました") };
  }

  redirect(routes.admin.publishers);
}
