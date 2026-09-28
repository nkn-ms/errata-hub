"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { AdminProfileRow } from "@/features/account/db/profiles";

// ⚠️ 付与した行をそのまま返さない。**クライアントへ渡る値なので db/ が返す形に揃える**
// （画面はアクセス権の一覧をこの型で持っていて、付与後にそこへ1件足す）。
export type GrantPublisherAccessResult =
  | { access: AdminProfileRow["publisherAccess"][number]; error?: undefined }
  | { access?: undefined; error: string };

export async function grantPublisherAccessUsecase(
  profileId: string,
  publisherId: string
): Promise<GrantPublisherAccessResult> {
  const admin = await requireAdminServerAction();

  try {
    // 自分自身には付けられない。付けると、その出版社の本への自分の回答が「運営者が代理で記載」
    // ではなく出版社本人の発言として公開される（services/publisher-access.ts は権限を持つ人を
    // ADMIN でも本人扱いにする）。「この人はその出版社の関係者だ」という判断を、判断する本人に
    // 向けて下せないようにする＝ロールの自己変更を塞いでいる updateUserRoleUsecase と同じ考え方
    if (profileId === admin.id) {
      return { error: "自分自身には出版社のアクセス権を付けられません" };
    }

    const parsed = z.string().uuid().safeParse(publisherId);
    if (!parsed.success) {
      return { error: "出版社の指定が不正です" };
    }

    // 付与と監査ログを1つのトランザクションにする。行にも出所（grantedBy*）が残るが、剥奪すると行ごと
    // 消えるので、**権限が存在した事実の履歴は監査ログにしか残らない**（剥奪側と対称にする）。
    const access = await prisma.$transaction(async (tx) => {
      const created = await tx.publisherAccess.create({
        // 付与の出所を行に持たせる（「なぜこの人が権限を持つのか」を出版社の画面から説明できるように）。
        // メールも控えるのは、付与した管理者が後に退会しても記録が読めるようにするため
        // （退会は匿名化＝ id は残るが email はスクラブされる）。
        data: {
          profileId,
          publisherId: parsed.data,
          grantedById: admin.id,
          grantedByEmail: admin.email,
        },
        include: { publisher: true, profile: { select: { email: true } } },
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.GRANT_PUBLISHER_ACCESS,
          targetType: TARGET_TYPE.PUBLISHER_ACCESS,
          targetId: profileId,
          // ⚠️ targetEmail は**誰に付与したか**（userEmail は操作した管理者であって対象者ではない）。
          //    ID だけだと後から DB で名寄せしないと読めず、退会・削除されると辿れなくなる。
          //    publisherName を残しているのと同じ考え方で、当時の値をそのまま持たせる。
          after: {
            targetEmail: created.profile.email,
            publisherId: parsed.data,
            publisherName: created.publisher.name,
          },
        },
        tx
      );

      return created;
    });

    return { access: { publisherId: access.publisherId, publisherName: access.publisher.name } };
  } catch (error) {
    console.error(error);
    return { error: "追加に失敗しました" };
  }
}
