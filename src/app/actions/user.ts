"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdminOrThrow } from "@/services/auth";
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
      data: { profileId, publisherId: parsed.data },
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
