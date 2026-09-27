"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { scrubProfileForWithdrawal, authUserExists } from "@/features/account/db/withdrawal";
import { isWithdrawnEmail, withdrawalConfirmationLabel } from "@/utils/withdrawal";
import type { UserActionState } from "@/features/account/types";

/**
 * 管理者による代行退会（スパム・規約違反・テスト垢の始末）。
 *
 * 「削除」ではなく本人の退会（usecases/withdraw-account.ts の withdrawAccountUsecase）と同じ処理を管理者が代行する。
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
export async function withdrawUserAsAdminUsecase(
  profileId: string,
  confirmation: string
): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    if (profileId === admin.id) {
      return { error: "自分自身を退会させることはできません" };
    }

    const target = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!target) {
      return { error: "ユーザーが見つかりません" };
    }
    // Profile がスクラブ済みでも、auth.users が残っていれば「途中で止まった退会」なので
    // ここから完了させられるようにする（= 取り残しを回収する管理者側の経路）。
    // 完了しているものだけを弾く。判定の理由は features/account/db/withdrawal.ts の authUserExists。
    if (isWithdrawnEmail(target.email) && !(await authUserExists(profileId))) {
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
      if (result.reason === "withdrawal-incomplete") {
        // 書き戻しにも失敗し、スクラブ済みなのにログインできる状態が残った。
        // 誰も気づけないまま放置されるのを防ぐために記録する（発見は /admin/logs）。
        // 本人からも、この画面からもう一度実行しても完了させられる。
        try {
          await createAuditLog({
            userId: admin.id,
            userEmail: admin.email,
            action: AUDIT_ACTION.WITHDRAWAL_INCOMPLETE,
            targetType: TARGET_TYPE.PROFILE,
            targetId: profileId,
          });
        } catch (error) {
          console.error("未完了の退会を記録できませんでした:", profileId, error);
        }
      }
      return { error: "退会処理に失敗しました。時間をおいて再度お試しください。" };
    }

    // 監査ログには実行した管理者を残す一方、対象の元メール・元表示名は残さない。
    // ここに残すと auth.users 削除後にこの UUID からメールを辿れる唯一の場所になり、
    // 無期限で PII を保持することになってしまうため（本人退会と同じ扱い）。
    //
    // ⚠️ 本人退会（usecases/withdraw-account.ts の withdrawAccountUsecase）と同じ理由で**塊にできない**（上の
    //    scrubProfileForWithdrawal が Supabase の admin API を叩く）。倒す方向も揃える:
    //    退会は既に成立して取り消せないので、記録の失敗で「失敗しました」とは返さない。
    try {
      await createAuditLog({
        userId: admin.id,
        userEmail: admin.email,
        action: AUDIT_ACTION.ADMIN_WITHDRAW_USER,
        targetType: TARGET_TYPE.PROFILE,
        targetId: profileId,
        after: result.scrubbed,
      });
    } catch (error) {
      console.error("代行退会の監査ログを記録できませんでした:", profileId, error);
    }

    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "退会処理に失敗しました" };
  }
}
