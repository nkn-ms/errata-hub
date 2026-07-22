import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { buildWithdrawnEmail } from "@/lib/withdrawal";

/**
 * 退会でスクラブされる Profile の PII 列。
 * ⚠️ Profile に PII 列を追加したら、必ずこの型と scrubProfileForWithdrawal に追従させること
 * （githubUsername / xUsername は列の追加時に追従が漏れていた実績がある）。
 */
export type ScrubbedProfile = {
  email: string;
  displayName: null;
  githubUsername: null;
  xUsername: null;
};

export type WithdrawalResult =
  | { ok: true; scrubbed: ScrubbedProfile }
  // auth.users の削除に失敗した＝Profile はまだ何も変更していない（呼び出し側は復帰できる）
  | { ok: false; reason: "auth-delete-failed" };

/**
 * 退会処理の実体。本人による退会（actions/auth.ts の withdraw）と
 * 管理者による代行（actions/user.ts の withdrawUserAsAdmin）で共有する。
 *
 * 投稿（Report）はコミュニティ資産として残し、投稿者の個人情報だけを消す。
 * Report.userId は Restrict なので Profile 行は物理削除できない → 残して PII をスクラブする。
 * 詳細方針: docs/design.md §7 / 決定メモ（退会＝匿名化）。
 *
 * 監査ログはここでは書かない。「本人が退会した」のか「管理者が代行した」のかで
 * 記録すべき実行者と action が変わるため、呼び出し側の責務にしている。
 */
export async function scrubProfileForWithdrawal(profileId: string): Promise<WithdrawalResult> {
  // 1) auth.users を物理削除（GDPR の核心: ログイン情報と Auth 側 PII を消す）。
  //    最も失敗しやすい外部呼び出しを先に行い、失敗時は何も変更せず復帰できるようにする。
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId);
  if (deleteError) {
    return { ok: false, reason: "auth-delete-failed" };
  }

  // 2) Profile の PII をスクラブ（email は @unique・必須なのでダミーで衝突回避、それ以外は null）。
  //    公開リンク（GitHub / X）も本人の外部アカウントに直結する個人情報なので併せて消す。
  const scrubbed: ScrubbedProfile = {
    email: buildWithdrawnEmail(profileId),
    displayName: null,
    githubUsername: null,
    xUsername: null,
  };
  await prisma.profile.update({
    where: { id: profileId },
    data: scrubbed,
  });

  return { ok: true, scrubbed };
}
