"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import type { AuthState } from "@/features/account/types";

const UpdatePasswordSchema = z.object({
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export async function updatePasswordUsecase(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = UpdatePasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  // recovery セッション（callback で確立済み）の本人パスワードを更新する。
  // セッションが無い場合は updateUser がエラーを返す。
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。" };
  }

  redirect(routes.home);
}
