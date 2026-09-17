import "server-only";
import { prisma } from "@/lib/prisma";
import { isWithdrawnEmail, WITHDRAWN_DISPLAY_NAME } from "@/utils/withdrawal";

/**
 * **プロフィールの読み取り（Data Access Layer）。** 条件と根拠は features/report/queries.ts の冒頭と同じ。
 *
 * ⭐ **このファイルの存在理由は「email を外へ出さないこと」。** 退会したかどうかは
 *    「メールが匿名化済みドメインか」でしか判定できない（= utils/withdrawal.ts）ので、
 *    判定には email が要る。**判定をここで済ませ、結果の真偽値だけを返す**ことで、
 *    呼び出し側は email を持つ値に触れなくなる。
 */

/** 公開プロフィール（誰でも見られる範囲）。⚠️ email は含めない。 */
export type PublicProfile = {
  id: string;
  /** 退会済みなら「退会済みユーザー」、未設定なら「匿名」に解決済み。 */
  displayName: string;
  isWithdrawn: boolean;
  githubUsername: string | null;
  xUsername: string | null;
  createdAt: Date;
};

/** 本人のアカウント設定に出す範囲。⚠️ email は含めない（画面が出しているのは Supabase 側の値）。 */
export type AccountSettings = {
  displayName: string | null;
  githubUsername: string | null;
  xUsername: string | null;
  createdAt: Date;
};

/** 公開プロフィール1件（存在しなければ null）。 */
export async function findPublicProfile(id: string): Promise<PublicProfile | null> {
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      email: true,
      githubUsername: true,
      xUsername: true,
      createdAt: true,
    },
  });
  if (!profile) return null;

  const withdrawn = isWithdrawnEmail(profile.email);
  return {
    id: profile.id,
    displayName: withdrawn ? WITHDRAWN_DISPLAY_NAME : (profile.displayName ?? "匿名"),
    isWithdrawn: withdrawn,
    // 退会済みなら公開リンクも出さない（表示側で分岐させず、ここで落とす）
    githubUsername: withdrawn ? null : profile.githubUsername,
    xUsername: withdrawn ? null : profile.xUsername,
    createdAt: profile.createdAt,
  };
}

/** 本人のアカウント設定（存在しなければ null）。 */
export function findAccountSettings(userId: string): Promise<AccountSettings | null> {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { displayName: true, githubUsername: true, xUsername: true, createdAt: true },
  });
}
