"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import type { AuthState } from "@/features/account/types";

const LoginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export async function loginAction(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  redirect(routes.home);
}

// ⚠️ メールアドレスでの新規登録（signUp）の操作は置いていない＝閉じている。
//    本番に独自 SMTP が無く、確認メールが一般の人に届かないため。理由と、開け直すときに
//    一緒に直すものは docs/design.md §7「メールでの新規登録は閉じている」。
