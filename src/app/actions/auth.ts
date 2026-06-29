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

const ResetRequestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

const UpdatePasswordSchema = z.object({
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = ResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 登録フローと同様に、戻り先 origin を明示してリクエスト元に合わせる
  // （Site URL へのフォールバックによる環境跨ぎの誤リダイレクトを防ぐ）。
  const h = await headers();
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const supabase = await createClient();
  // メールのリンクは PKCE code 付きで /auth/callback に戻る。callback が code を
  // recovery セッションに交換し、next=updatePassword へ転送する。
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${routes.auth.callback}?next=${routes.auth.updatePassword}`,
  });

  // アカウント列挙対策: 宛先の存在に関わらず常に成功扱いで送信完了画面へ。
  redirect(routes.auth.resetPasswordSent);
}

export async function updatePassword(
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

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 公開掲示板なのでログアウト後もゲストとして閲覧できる。トップに戻すのが自然。
  redirect(routes.home);
}
