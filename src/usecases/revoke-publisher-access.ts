"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { UserActionState } from "@/features/account/types";

export async function revokePublisherAccess(
  profileId: string,
  publisherId: string
): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    // 付与側と同じく形を検査する（片方だけ素通しだと、同じ値を送っても結果が割れる）
    const parsed = z.string().uuid().safeParse(publisherId);
    if (!parsed.success) {
      return { error: "出版社の指定が不正です" };
    }

    // 剥奪と監査ログを1つの塊にする。行ごと消えるので、**権限が存在した事実は監査ログにしか残らない**。
    const revoked = await prisma.$transaction(async (tx) => {
      const publisher = await tx.publisher.findUnique({ where: { id: parsed.data } });
      // 誰から剥奪したかを記録に残すため（付与側 = usecases/grant-publisher-access.ts と対称。理由はあちらのコメント）
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { email: true },
      });

      // deleteMany は対象が無くても成功する。**0件のまま監査ログを書くと「剥奪した」という
      // 起きていない操作の記録が残る**ので、消えた件数で分岐する。
      // 記録は後から説明するためのものなので、事実でない行を増やさないことが目的。
      const { count } = await tx.publisherAccess.deleteMany({
        where: { profileId, publisherId: parsed.data },
      });
      if (count === 0) return false;

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.REVOKE_PUBLISHER_ACCESS,
          targetType: TARGET_TYPE.PUBLISHER_ACCESS,
          targetId: profileId,
          before: {
            targetEmail: profile?.email,
            publisherId: parsed.data,
            publisherName: publisher?.name,
          },
        },
        tx
      );

      return true;
    });

    if (!revoked) {
      return { error: "このユーザーはその出版社のアクセス権を持っていません" };
    }

    return {};
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }
}
