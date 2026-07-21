"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { buildWithdrawnEmail } from "@/lib/withdrawal";
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

// 確認メール / OAuth / パスワード再発行の戻り先を、環境を跨がずリクエスト元に合わせるための origin。
// これを明示しないと Supabase の Site URL にフォールバックし、環境跨ぎの誤リダイレクト
// （本番なのに localhost へ等）や callback を経由せず未ログインになる不具合が起きる。
// origin ヘッダが無い場合は x-forwarded-proto/host（無ければ host）から組み立てる。
async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  return (
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  );
}

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

  // 確認メールのリンクから戻る先をリクエスト元に合わせて明示する（理由は getRequestOrigin 参照）。
  const origin = await getRequestOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // display_name はメール確認後の callback で Profile.displayName（表示の正）を
      // 作るための運搬用。以後 user_metadata は参照しない（updateDisplayName の方針コメント参照）。
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}${routes.auth.callback}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(routes.auth.confirm);
}

/**
 * GitHub ログイン（OAuth 開始）。
 *
 * signInWithOAuth はサーバーでは自動リダイレクトせず認可 URL を返すだけなので、
 * redirect() で GitHub へ送る。PKCE の code verifier は @supabase/ssr が
 * Cookie に保存し、GitHub から戻った /auth/callback の exchangeCodeForSession が消費する。
 * 参考: https://supabase.com/docs/guides/auth/social-login/auth-github
 */
export async function signInWithGitHub() {
  const origin = await getRequestOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}${routes.auth.callback}` },
  });

  if (error || !data.url) {
    redirect(routes.auth.error);
  }
  redirect(data.url);
}

const ResetRequestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

const UpdatePasswordSchema = z.object({
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

/**
 * パスワード再発行メールの送信。
 * フロー全体（resetPasswordForEmail → メール → /auth/callback → パスワード更新）は公式の形。
 * 参考: https://supabase.com/docs/guides/auth/passwords
 */
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

const DisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(50, "表示名は50文字以内で入力してください"),
});

export type ProfileState = { error?: string; success?: boolean } | undefined;

/**
 * 表示名の変更（本人のセルフサービス）。
 *
 * 表示の正は Profile.displayName のみ。user_metadata.display_name は会員登録フォームから
 * callback での Profile 作成へ値を運ぶ一度きりの用途で、以後は参照も同期もしない
 * （二重管理にすると OAuth ログイン等の経路ごとに同期漏れが起きるため）。
 * プライバシーポリシー第7条3項（表示名は本サービス上で変更可能）と対応。
 */
export async function updateDisplayName(
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
    await prisma.profile.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName },
    });
  } catch (error) {
    // Profile 行が無い（P2025）等の失敗はエラーページにせず、他アクションと同じく {error} を返す
    console.error(error);
    return { error: "表示名の更新に失敗しました" };
  }

  revalidatePath(routes.account);
  return { success: true };
}

// 空文字は「未設定に戻す」として null に落とす。URL ではなくユーザー名で保存し、
// 表示側で https://github.com/... を組み立てる（任意 URL を貼らせない＝リンク先偽装の余地を断つ）。
const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/; // 英数字とハイフン39文字以内・先頭末尾/連続ハイフン不可
const X_USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/; // 英数字とアンダースコア15文字以内

const ProfileLinksSchema = z.object({
  githubUsername: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || GITHUB_USERNAME_RE.test(v), {
      message: "GitHubのユーザー名の形式が正しくありません（英数字とハイフン、39文字以内）",
    }),
  xUsername: z
    .string()
    .trim()
    // URL やハンドルをそのまま貼る人向けに @ 前置きだけは剥がして受け付ける
    .transform((v) => v.replace(/^@/, ""))
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || X_USERNAME_RE.test(v), {
      message: "Xのユーザー名の形式が正しくありません（英数字とアンダースコア、15文字以内）",
    }),
});

/**
 * 公開リンク（GitHub / X）の変更（本人のセルフサービス）。
 *
 * ログイン手段とは独立した自己申告のプロフィール項目。本人が入力した場合のみ公開される。
 */
export async function updateProfileLinks(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = ProfileLinksSchema.safeParse({
    githubUsername: formData.get("githubUsername") ?? "",
    xUsername: formData.get("xUsername") ?? "",
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
    await prisma.profile.update({
      where: { id: user.id },
      data: parsed.data,
    });
  } catch (error) {
    // Profile 行が無い（P2025）等の失敗はエラーページにせず、他アクションと同じく {error} を返す
    console.error(error);
    return { error: "公開リンクの更新に失敗しました" };
  }

  revalidatePath(routes.account);
  return { success: true };
}

/**
 * 退会（アカウント匿名化）。
 *
 * 投稿（Report）はコミュニティ資産として残し、投稿者の個人情報だけを消す。
 * Report.userId は Restrict なので Profile 行は物理削除できない → 残して PII をスクラブする。
 * 詳細方針: docs/design.md §7 / 決定メモ（退会＝匿名化）。
 */
export async function withdraw(_prevState: AuthState): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  // 1) auth.users を物理削除（GDPR の核心: ログイン情報と Auth 側 PII を消す）。
  //    最も失敗しやすい外部呼び出しを先に行い、失敗時は何も変更せず復帰できるようにする。
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { error: "退会処理に失敗しました。時間をおいて再度お試しください。" };
  }

  // 2) Profile の PII をスクラブ（email は @unique・必須なのでダミーで衝突回避、それ以外は null）。
  //    公開リンク（GitHub / X）も本人の外部アカウントに直結する個人情報なので併せて消す。
  //    ⚠️ Profile に PII 列を追加したら、必ずこのスクラブにも追従させること
  //    （githubUsername / xUsername は列の追加時に追従が漏れていた実績がある）。
  const scrubbedProfile = {
    email: buildWithdrawnEmail(user.id),
    displayName: null,
    githubUsername: null,
    xUsername: null,
  };
  await prisma.profile.update({
    where: { id: user.id },
    data: scrubbedProfile,
  });

  // 3) 監査ログに退会を記録する。誰がいつ退会したかは userId で追える。
  //    退会は本人の PII を消すことが目的なので、元メール・元表示名は監査ログにも残さない。
  //    ここに残すと、auth.users 削除後にこの UUID からメールを辿れる唯一の場所になり、
  //    無期限で PII を保持することになってしまうため（プライバシーポリシー第6条参照）。
  await createAuditLog({
    userId: user.id,
    action: "WITHDRAW_USER",
    targetType: TARGET_TYPE.PROFILE,
    targetId: user.id,
    after: scrubbedProfile,
  });

  // 4) セッションを破棄して退会完了ページへ。
  await supabase.auth.signOut();
  redirect(routes.accountWithdrawn);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 公開掲示板なのでログアウト後もゲストとして閲覧できる。トップに戻すのが自然。
  redirect(routes.home);
}
