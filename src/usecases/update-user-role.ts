"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { UserActionState } from "@/features/account/types";

const RoleSchema = z.enum(["ADMIN", "USER"]);

export async function updateUserRole(profileId: string, role: string): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = RoleSchema.safeParse(role);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    // 自分自身のロールは変えられない。**管理者が0人になる状態を構造的に防ぐ**ため。
    // ロールを減らせる操作はこれだけなので、自己降格さえ塞げば「誰かは必ず ADMIN」が保たれる
    // （他人を降格させても、降格させた本人が ADMIN のまま残るため）。
    // 0人になるとアプリからは誰も戻せず、DB を直接触るしかなくなる＝取り返しがつかない。
    //
    // 昇格方向も一緒に塞ぐのは、規則を単純に保つため（自分を ADMIN にする意味は無い）。
    // 代行退会の「自分自身は対象にできない」と同じ考え方 = withdrawUserAsAdmin。
    //
    // ⚠️ 代償として、**管理者が1人の間はその人が退会できない**（本人退会にも管理者ガードが
    //    あるため）。2026-08-04 に運営者が承知のうえで受け入れた仕様で、不具合ではない
    //    ＝ usecases/withdraw-account.ts の withdrawAccount に詳細。
    if (profileId === admin.id) {
      return { error: "自分自身のロールは変更できません。他の管理者に依頼してください" };
    }

    // ロール変更と監査ログを1つの塊にする（理由は usecases/delete-report.ts の deleteReport）。
    // 行に残るのは現在のロールだけなので、**誰が昇格させたかは監査ログにしか残らない**。
    await prisma.$transaction(async (tx) => {
      const before = await tx.profile.findUnique({ where: { id: profileId } });
      const profile = await tx.profile.update({
        where: { id: profileId },
        data: { role: parsed.data },
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_USER_ROLE,
          targetType: TARGET_TYPE.PROFILE,
          targetId: profileId,
          before: { role: before?.role },
          after: { role: profile.role },
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
