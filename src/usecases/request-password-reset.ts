"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import { getRequestOrigin } from "@/services/auth";
import type { AuthState } from "@/features/account/types";

const ResetRequestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

/**
 * パスワード再発行メールの送信。
 * フロー全体（resetPasswordForEmail → メール → /auth/callback → パスワード更新）は公式の形。
 * 参考: https://supabase.com/docs/guides/auth/passwords
 */
export async function requestPasswordResetUsecase(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = ResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const origin = await getRequestOrigin();

  const supabase = await createClient();
  // メールのリンクは PKCE code 付きで /auth/callback に戻る。callback が code を
  // recovery セッションに交換し、next=updatePassword へ転送する。
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${routes.auth.callback}?next=${routes.auth.updatePassword}`,
  });

  // アカウント列挙対策: 宛先の存在に関わらず常に成功扱いで送信完了画面へ。
  redirect(routes.auth.resetPasswordSent);
}
