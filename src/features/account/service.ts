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

/** 補償（書き戻し）に使う退会前の値。ScrubbedProfile と同じ列を、元の型のまま持つ。 */
type OriginalProfile = {
  email: string;
  displayName: string | null;
  githubUsername: string | null;
  xUsername: string | null;
};

export type WithdrawalResult =
  | { ok: true; scrubbed: ScrubbedProfile }
  /** 対象の Profile が無い（通常起きない。呼び出し側が存在を確かめてから呼ぶため） */
  | { ok: false; reason: "profile-not-found" }
  /** auth.users を消せず、**スクラブは書き戻した**＝何も起きていない。再試行を促してよい */
  | { ok: false; reason: "auth-delete-failed" }
  /**
   * auth.users を消せず、**書き戻しにも失敗した**＝スクラブ済みなのにログインできる状態。
   *
   * ⚠️ 呼び出し側は**この状態を監査ログに残すこと**（誰も気づけないまま放置されるのを防ぐ）。
   * 退会は未完了だが、当初の目的（auth 削除＋スクラブ）には**まだ到達できる**:
   * 本人がもう一度退会すれば完了し、管理者の代行退会からも完了させられる。
   */
  | { ok: false; reason: "withdrawal-incomplete" };

/** Supabase の「そのユーザーは存在しない」。リトライ時は既に消えているのが正常なので成功と見なす。 */
function isUserAlreadyDeleted(error: { code?: string; status?: number }): boolean {
  return error.code === "user_not_found" || error.status === 404;
}

/**
 * auth.users に行が残っているか。**退会が途中で止まっていないか**を見分けるために使う。
 *
 * Profile がスクラブ済みでも auth.users が残っていれば、それは「完了した退会」ではなく
 * 「補償に失敗して途中で止まった退会」。管理者がそこから完了させられるよう、
 * 「既に退会済み」の判定にこれを重ねる（= actions/user.ts / admin/users/[id]）。
 *
 * ⚠️ 判定できないとき（通信断など）は **true（残っている）を返さない**。
 * 「退会済み扱いで止める」側に倒すと、実際には未完了のものを取りこぼすため。
 */
export async function authUserExists(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error) {
    if (isUserAlreadyDeleted(error)) return false;
    // 分からないときは「残っているかもしれない」＝完了させる道を塞がない
    console.error("auth.users の存在確認に失敗:", profileId, error);
    return true;
  }
  return !!data.user;
}

/**
 * 退会処理の実体。本人による退会（actions/auth.ts の withdraw）と
 * 管理者による代行（actions/user.ts の withdrawUserAsAdmin）で共有する。
 *
 * 投稿（Report）はコミュニティ資産として残し、投稿者の個人情報だけを消す。
 * Report.userId は Restrict なので Profile 行は物理削除できない → 残して PII をスクラブする。
 * 詳細方針: docs/design.md §7 / 決定メモ（退会＝匿名化）。
 *
 * ## 順序と補償（2026-08-04 の設計判断）
 *
 * 2つのストア（Supabase Auth と Postgres）にまたがるのでトランザクションで包めない。
 * そこで **取り消せない操作（auth.users の削除）を最後に置き、その手前までは巻き戻せるようにする**:
 *
 *   1) 退会前の PII を読む（補償に使うのでメモリに持つ）
 *   2) Profile の PII をスクラブ（Postgres・戻せる）
 *   3) auth.users を物理削除（外部・**取り消せない**）
 *   4) 3 が失敗したら 2 を書き戻す＝呼び出し側から見て何も起きていない状態に戻す
 *
 * ⚠️ **以前は 3 を先に実行していた**。「最も失敗しやすい外部呼び出しを先に行い、失敗時は何も
 *    変更せず復帰できる」という意図だったが、**2 が失敗したときに『ログインは永久に不可・
 *    PII は残存』という誰も回復できない状態**になっていた（本人はログインできず、管理者の
 *    代行退会も deleteUser が対象不在で失敗するため通らなかった）。
 *    fail fast は利便性、不可逆性は正しさなので、後者を優先する。
 *
 * ⚠️ **退会そのものを取り消す手段は無い**（元のメール・表示名はどこにも保存しない＝監査ログにも
 *    残さない方針のため）。4 の書き戻しが成立するのは、元の値がまだこの関数のメモリにある間だけ。
 *
 * 監査ログはここでは書かない。「本人が退会した」のか「管理者が代行した」のかで
 * 記録すべき実行者と action が変わるため、呼び出し側の責務にしている
 * （`withdrawal-incomplete` の記録も同じ理由で呼び出し側が書く）。
 */
export async function scrubProfileForWithdrawal(profileId: string): Promise<WithdrawalResult> {
  // 1) 退会前の値を控える。3 が失敗したときに書き戻すため。
  const original: OriginalProfile | null = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { email: true, displayName: true, githubUsername: true, xUsername: true },
  });
  if (!original) {
    return { ok: false, reason: "profile-not-found" };
  }

  // 2) Profile の PII をスクラブ（email は @unique・必須なのでダミーで衝突回避、それ以外は null）。
  //    公開リンク（GitHub / X）も本人の外部アカウントに直結する個人情報なので併せて消す。
  const scrubbed: ScrubbedProfile = {
    email: buildWithdrawnEmail(profileId),
    displayName: null,
    githubUsername: null,
    xUsername: null,
  };
  await prisma.profile.update({ where: { id: profileId }, data: scrubbed });

  // 3) auth.users を物理削除（GDPR の核心: ログイン情報と Auth 側 PII を消す）。取り消せない。
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId);
  // 既に消えている＝前回の試行で 3 まで到達していた。リトライを収束させるため成功扱いにする。
  if (deleteError && !isUserAlreadyDeleted(deleteError)) {
    // 4) 補償: スクラブを書き戻して「何も起きていない」状態に戻す。
    try {
      await prisma.profile.update({ where: { id: profileId }, data: original });
    } catch (restoreError) {
      // 書き戻しにも失敗した＝スクラブ済みなのにログインできる状態が残る。
      // 当初の目的にはまだ到達できる（本人・管理者のどちらからでも完了させられる）ので、
      // 呼び出し側が監査ログに残して発見できるようにする。
      console.error("退会の書き戻しに失敗:", profileId, restoreError);
      return { ok: false, reason: "withdrawal-incomplete" };
    }
    console.error("auth.users の削除に失敗（Profile は書き戻し済み）:", profileId, deleteError);
    return { ok: false, reason: "auth-delete-failed" };
  }

  return { ok: true, scrubbed };
}
