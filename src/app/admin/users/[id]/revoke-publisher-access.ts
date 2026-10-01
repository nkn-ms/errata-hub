"use server";

import { z } from "zod";
import { runInTransaction } from "@/services/transaction";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { findProfileEmail } from "@/features/account/db/profiles";
import { revokePublisherAccess } from "@/features/account/db/publisher-access";
import { findPublisherName } from "@/features/publisher/db/publishers";
import type { UserActionState } from "@/features/account/types";

export async function revokePublisherAccessAction(
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

    // 剥奪と監査ログを1つのトランザクションにする。行ごと消えるので、**権限が存在した事実は監査ログにしか残らない**。
    const revoked = await runInTransaction(async (tx) => {
      const publisherName = await findPublisherName(parsed.data, tx);
      // 誰から剥奪したかを記録に残すため（付与側 = features/account/actions/grant-publisher-access.ts と対称。理由はあちらのコメント）
      const targetEmail = await findProfileEmail(profileId, tx);

      // **持っていなかったのに監査ログを書くと「剥奪した」という起きていない操作の記録が残る**ので、
      // 書かずに抜ける。記録は後から説明するためのものなので、事実でない行を増やさないことが目的。
      const removed = await revokePublisherAccess(profileId, parsed.data, tx);
      if (!removed) return false;

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.REVOKE_PUBLISHER_ACCESS,
          targetType: TARGET_TYPE.PUBLISHER_ACCESS,
          targetId: profileId,
          before: {
            targetEmail,
            publisherId: parsed.data,
            publisherName,
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
