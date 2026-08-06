"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { scrubProfileForWithdrawal } from "@/services/withdrawal";
import { routes } from "@/constants/routes";
import { PROFILE_LIMITS } from "@/constants/profile-limits";

const LoginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

const RegisterSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  displayName: z
    .string()
    .min(1, "表示名を入力してください")
    .max(PROFILE_LIMITS.displayName, `表示名は${PROFILE_LIMITS.displayName}文字以内で入力してください`),
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
    .max(PROFILE_LIMITS.displayName, `表示名は${PROFILE_LIMITS.displayName}文字以内で入力してください`),
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

  // 上の updateDisplayName と同じ理由で `revalidatePath` ではなく `refresh` を使う
  refresh();
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

  // 管理者は退会できない（代行退会 = actions/user.ts の withdrawUserAsAdmin と同じ規則）。
  // 管理者が0人になるとアプリから戻す手段が無くなり、DB を直接触るしかなくなる＝取り返しがつかない。
  // 退会したい管理者は、先に他の管理者にロールを「一般」へ変更してもらう（自分では変えられない）。
  //
  // ⚠️ **代償を承知のうえでこうしている（2026-08-04 の運営者の判断）**:
  //    管理者が1人しかいない間、その人は退会できない（自分でロールも落とせないため）。
  //    GitHub の「最後の Owner は組織を抜けられない」と同じ形で、**不具合ではない**。
  //    緩めるには「管理者が2人以上いれば自己降格を許す」と数える方式にするしかないが、
  //    数え方には競合の隙間ができるため、確実さを優先してこの形を選んでいる。
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (profile?.role === "ADMIN") {
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
  // ⚠️ ここは他の管理操作と違い**塊にできない**。1) が Supabase の admin API（外部）を叩くため
  //    トランザクションに入らないので、「記録が残らないなら操作も成立させない」形が取れない。
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

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 公開掲示板なのでログアウト後もゲストとして閲覧できる。トップに戻すのが自然。
  redirect(routes.home);
}
