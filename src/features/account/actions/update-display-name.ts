"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import { PROFILE_LIMITS } from "@/features/account/constants";
import { updateDisplayName } from "@/features/account/db/profiles";
import type { ProfileState } from "@/features/account/types";

const DisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(PROFILE_LIMITS.displayName, `表示名は${PROFILE_LIMITS.displayName}文字以内で入力してください`),
});

/**
 * 表示名の変更（本人のセルフサービス）。
 *
 * 表示の正は Profile.displayName のみ。user_metadata.display_name は会員登録フォームから
 * callback での Profile 作成へ値を運ぶ一度きりの用途で、以後は参照も同期もしない
 * （二重管理にすると OAuth ログイン等の経路ごとに同期漏れが起きるため）。
 * プライバシーポリシー第7条3項（表示名は本サービス上で変更可能）と対応。
 */
export async function updateDisplayNameAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = DisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  try {
    await updateDisplayName(user.id, parsed.data.displayName);
  } catch (error) {
    // Profile 行が無い（P2025）等の失敗はエラーページにせず、他アクションと同じく {error} を返す
    console.error(error);
    return { error: "表示名の更新に失敗しました" };
  }

  // 変更後の値を、いま見ている画面に反映する＝クライアントルーターの更新（`refresh` の役割）。
  //
  // ⚠️ ここは `revalidatePath` ではない。あちらの役割は **Next のキャッシュの無効化**だが、
  //    このプロジェクトは Next のキャッシュ機構を使っていない（`use cache` / `cacheTag` /
  //    `unstable_cache` / `revalidateTag` いずれも 0 件・CSP の nonce で全ページ動的）ので、
  //    無効化する対象が無い。それでも画面が更新されるのは `revalidatePath` の副次的な効果で、
  //    公式ドキュメントはその効果を「一時的で、将来は指定パスだけに限定される」と明記している。
  //    ⇒ 依存する契約が明文化されている方を呼ぶ。
  //
  // ℹ️ 実測（2026-08-04）では両者に**挙動の差は無い**。クライアントキャッシュの dynamic の
  //    既定が 0 秒（キャッシュしない）で、遷移のたびに取り直されるため。
  refresh();
  return { success: true };
}
