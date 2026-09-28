import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * **出版社のアクセス権（PublisherAccess）の付与と剥奪。** 管理者がユーザー管理の画面から行う。
 * 条件と根拠は features/report/db/reports.ts の冒頭と同じ（認可は呼び出し側の usecase）。
 *
 * ⚠️ 「この人はこの投稿に出版社として回答できるか」の判定は services/publisher-access.ts
 *    （回答の操作が使う横断処理）。ここは行を足し引きするだけ。
 */

/**
 * アクセス権を付与し、付与した行を返す（監査ログに残す出版社名と、対象者のメールを含む）。
 *
 * 付与の出所（grantedBy*）を行に持たせる＝「なぜこの人が権限を持つのか」を出版社の画面から説明できるように。
 * メールも控えるのは、付与した管理者が後に退会しても記録が読めるようにするため
 * （退会は匿名化＝ id は残るが email はスクラブされる）。
 */
export function grantPublisherAccess(
  grant: { profileId: string; publisherId: string; grantedById: string; grantedByEmail: string | undefined },
  client: Prisma.TransactionClient = prisma
) {
  return client.publisherAccess.create({
    data: grant,
    include: { publisher: true, profile: { select: { email: true } } },
  });
}

/**
 * アクセス権を剥奪する。剥奪できたら true、その人が持っていなければ false
 * （deleteMany は対象が無くても成功するので、消えた件数で判定する）。
 */
export async function revokePublisherAccess(
  profileId: string,
  publisherId: string,
  client: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const { count } = await client.publisherAccess.deleteMany({ where: { profileId, publisherId } });
  return count > 0;
}
