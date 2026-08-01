"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdminOrThrow } from "@/services/auth";
import { scrubProfileForWithdrawal } from "@/services/withdrawal";
import { isWithdrawnEmail, withdrawalConfirmationLabel } from "@/lib/withdrawal";
import type { Publisher, PublisherAccess } from "@/generated/prisma/client";

const RoleSchema = z.enum(["ADMIN", "USER"]);

export type UserActionState = { error?: string };

export async function updateUserRole(profileId: string, role: string): Promise<UserActionState> {
  const admin = await requireAdminOrThrow();

  try {
    const parsed = RoleSchema.safeParse(role);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const before = await prisma.profile.findUnique({ where: { id: profileId } });
    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: { role: parsed.data },
    });

    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "UPDATE_USER_ROLE",
      targetType: TARGET_TYPE.PROFILE,
      targetId: profileId,
      before: { role: before?.role },
      after: { role: profile.role },
    });

    // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

export type PublisherAccessWithPublisher = PublisherAccess & { publisher: Publisher };
export type GrantPublisherAccessResult =
  | { access: PublisherAccessWithPublisher; error?: undefined }
  | { access?: undefined; error: string };

export async function grantPublisherAccess(
  profileId: string,
  publisherId: string
): Promise<GrantPublisherAccessResult> {
  const admin = await requireAdminOrThrow();

  try {
    const parsed = z.string().uuid().safeParse(publisherId);
    if (!parsed.success) {
      return { error: "出版社の指定が不正です" };
    }

    const access = await prisma.publisherAccess.create({
      // 付与の出所を行に持たせる（「なぜこの人が権限を持つのか」を出版社の画面から説明できるように）。
      // メールも控えるのは、付与した管理者が後に退会しても記録が読めるようにするため
      // （退会は匿名化＝ id は残るが email はスクラブされる）。
      data: {
        profileId,
        publisherId: parsed.data,
        grantedById: admin.id,
        grantedByEmail: admin.email,
      },
      include: { publisher: true },
    });

    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "GRANT_PUBLISHER_ACCESS",
      targetType: TARGET_TYPE.PUBLISHER_ACCESS,
      targetId: profileId,
      after: { publisherId: parsed.data, publisherName: access.publisher.name },
    });

    return { access };
  } catch (error) {
    console.error(error);
    return { error: "追加に失敗しました" };
  }
}

/**
 * 管理者による代行退会（スパム・規約違反・テスト垢の始末）。
 *
 * 「削除」ではなく本人の退会（actions/auth.ts の withdraw）と同じ処理を管理者が代行する。
 * Profile 行そのものは消さない: Report.userId が Restrict で消せない上に、
 * ログイン不可・PII 消去という目的はスクラブだけで達成できるため
 * （残るのは表示名 null・メールがダミーの抜け殻＝ [孤児行は許容] の判断と同じ）。
 *
 * ⚠️ 取り消せない。本人が再登録しても UUID が変わるので過去の投稿とは結び付かない。
 * そのため「押し間違い」を止める防御を4つ重ねている:
 *   1) 対象の表示名（無ければメール）を手入力させ、サーバー側でも照合する
 *   2) 自分自身は対象にできない（最後の管理者が自分を消す事故を構造的に防ぐ）
 *   3) ADMIN ロールは直接できない（先に「一般」へ落とす2手順を踏ませる）
 *   4) 監査ログに「どの管理者が誰を」を残す
 */
export async function withdrawUserAsAdmin(
  profileId: string,
  confirmation: string
): Promise<UserActionState> {
  const admin = await requireAdminOrThrow();

  try {
    if (profileId === admin.id) {
      return { error: "自分自身を退会させることはできません" };
    }

    const target = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!target) {
      return { error: "ユーザーが見つかりません" };
    }
    if (isWithdrawnEmail(target.email)) {
      return { error: "このユーザーは既に退会済みです" };
    }
    if (target.role === "ADMIN") {
      return { error: "管理者は退会させられません。先にロールを「一般」に変更してください" };
    }
    if (confirmation !== withdrawalConfirmationLabel(target)) {
      return { error: "確認のため、表示された名前をそのまま入力してください" };
    }

    const result = await scrubProfileForWithdrawal(profileId);
    if (!result.ok) {
      return { error: "退会処理に失敗しました。時間をおいて再度お試しください。" };
    }

    // 監査ログには実行した管理者を残す一方、対象の元メール・元表示名は残さない。
    // ここに残すと auth.users 削除後にこの UUID からメールを辿れる唯一の場所になり、
    // 無期限で PII を保持することになってしまうため（本人退会と同じ扱い）。
    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "ADMIN_WITHDRAW_USER",
      targetType: TARGET_TYPE.PROFILE,
      targetId: profileId,
      after: result.scrubbed,
    });

    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "退会処理に失敗しました" };
  }
}

export async function revokePublisherAccess(
  profileId: string,
  publisherId: string
): Promise<UserActionState> {
  const admin = await requireAdminOrThrow();

  try {
    const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });

    await prisma.publisherAccess.deleteMany({
      where: { profileId, publisherId },
    });

    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "REVOKE_PUBLISHER_ACCESS",
      targetType: TARGET_TYPE.PUBLISHER_ACCESS,
      targetId: profileId,
      before: { publisherId, publisherName: publisher?.name },
    });

    return {};
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }
}
