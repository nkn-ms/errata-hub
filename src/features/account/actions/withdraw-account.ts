"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { scrubProfileForWithdrawal } from "@/features/account/db/withdrawal";
import { findProfileRole } from "@/features/account/db/profiles";
import { routes } from "@/constants/routes";
import type { AuthState } from "@/features/account/types";

/**
 * 退会（アカウント匿名化）。
 *
 * 投稿（Report）はコミュニティ資産として残し、投稿者の個人情報だけを消す。
 * Report.userId は Restrict なので Profile 行は物理削除できない → 残して PII をスクラブする。
 * 詳細方針: docs/design.md §7 / 決定メモ（退会＝匿名化）。
 */
export async function withdrawAccountAction(_prevState: AuthState): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  // 管理者は退会できない（代行退会 = features/account/actions/withdraw-user-as-admin.ts の withdrawUserAsAdminAction と同じ規則）。
  // 管理者が0人になるとアプリから戻す手段が無くなり、DB を直接触るしかなくなる＝取り返しがつかない。
  // 退会したい管理者は、先に他の管理者にロールを「一般」へ変更してもらう（自分では変えられない）。
  //
  // ⚠️ **代償を承知のうえでこうしている（2026-08-04 の運営者の判断）**:
  //    管理者が1人しかいない間、その人は退会できない（自分でロールも落とせないため）。
  //    GitHub の「最後の Owner は組織を抜けられない」と同じ形で、**不具合ではない**。
  //    緩めるには「管理者が2人以上いれば自己降格を許す」と数える方式にするしかないが、
  //    数え方には競合の隙間ができるため、確実さを優先してこの形を選んでいる。
  const role = await findProfileRole(user.id);
  if (role === "ADMIN") {
    return {
      error: "管理者アカウントは退会できません。先に他の管理者にロールを変更してもらってください。",
    };
  }

  // 1) Profile のスクラブと auth.users の削除（管理者による代行退会と共通の処理）。
  //    失敗しても書き戻されるので、この文言（再度お試しください）は事実になる。
  const result = await scrubProfileForWithdrawal(user.id);
  if (!result.ok) {
    if (result.reason === "withdrawal-incomplete") {
      // 書き戻しにも失敗し、スクラブ済みなのにログインできる状態が残った。
      // **誰も気づけないまま放置されるのを防ぐ**ために記録する（発見は /admin/logs）。
      // 本人がもう一度退会を押せば完了するので、当初の目的にはまだ到達できる。
      try {
        await createAuditLog({
          userId: user.id,
          action: AUDIT_ACTION.WITHDRAWAL_INCOMPLETE,
          targetType: TARGET_TYPE.PROFILE,
          targetId: user.id,
        });
      } catch (error) {
        console.error("未完了の退会を記録できませんでした:", user.id, error);
      }
    }
    return { error: "退会処理に失敗しました。時間をおいて再度お試しください。" };
  }

  // 2) 監査ログに退会を記録する。誰がいつ退会したかは userId で追える。
  //    退会は本人の PII を消すことが目的なので、元メール・元表示名は監査ログにも残さない。
  //    ここに残すと、auth.users 削除後にこの UUID からメールを辿れる唯一の場所になり、
  //    無期限で PII を保持することになってしまうため（プライバシーポリシー第6条参照）。
  //
  // ⚠️ ここは他の管理操作と違い、記録と操作を**1つのトランザクションにまとめられない**。
  //    1) が Supabase の admin API（外部）を叩くためで、「記録が残らないなら操作も成立させない」形が取れない。
  //    そこで倒す方向を決めている: **退会は成立させる**。ここまで来た時点で auth.users は既に
  //    消えていて取り消せないので、記録の失敗で「失敗しました」と返すのは嘘になるうえ、
  //    3) の signOut に到達せずセッションだけが残る（＝ログインできないのに画面はログイン中）。
  try {
    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTION.WITHDRAW_USER,
      targetType: TARGET_TYPE.PROFILE,
      targetId: user.id,
      after: result.scrubbed,
    });
  } catch (error) {
    console.error("退会の監査ログを記録できませんでした:", user.id, error);
  }

  // 3) セッションを破棄して退会完了ページへ。
  await supabase.auth.signOut();
  redirect(routes.accountWithdrawn);
}
