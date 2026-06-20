"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";

const LoginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

const RegisterSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  displayName: z.string().min(1, "表示名を入力してください").max(50, "表示名は50文字以内で入力してください"),
});

export type AuthState = { error?: string } | undefined;

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
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

export async function register(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 確認メールのリンクから戻る先を、リクエスト元の origin に合わせて明示する。
  // これが無いと Supabase の Site URL にフォールバックし、環境を跨いだ誤リダイレクト
  // （本番なのに localhost へ等）や、callback を経由せず未ログインになる不具合が起きる。
  const h = await headers();
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}${routes.auth.callback}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(routes.auth.confirm);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 公開掲示板なのでログアウト後もゲストとして閲覧できる。トップに戻すのが自然。
  redirect(routes.home);
}
