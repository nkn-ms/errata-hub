import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { routes } from "@/constants/routes";

// 認可ヘルパは Server Action 用と サーバーコンポーネント用の2つ。管理操作の入口がこの2つだけのため。
// Route Handler 用（判定結果を Response で返す版）が要るときは checkAdmin から書き足す。
//
// ⚠️ **管理者以外の認可はここには置かない**（このファイルの認可は ADMIN 判定だけ）。
// 「その投稿の投稿者か」は usecases/ の各操作（updateOwnReportUsecase 等）と画像の Route Handler に、
// 「その出版社として回答できるか」は services/publisher-access.ts にある。
//
// 末尾の getRequestOrigin・startOAuth は認可ではなく認証（ログイン）の側。複数の操作が使うので、
// usecases ではなくここに置く（"use server" のファイルから export すると、ブラウザから呼べる口になる）。

/**
 * 認可判定のコア。Supabase の認証ユーザーと ADMIN ロールを確認する。
 * 失敗モード（未認証 / 権限なし）を呼び出し側に委ねるため、ここでは投げず判定結果だけ返す。
 */
async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" as const };

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { role: true } });
  if (profile?.role !== "ADMIN") return { ok: false as const, reason: "forbidden" as const };

  return { ok: true as const, user };
}

/**
 * 認証済み ADMIN ユーザーであることを検証する。
 * 失敗時は throw する（アクションの戻り値では返さない＝呼び出し側が握り潰せない）。
 * 成功時は監査ログの実行者として記録するため user を返す。
 */
export async function requireAdminServerAction() {
  const result = await checkAdmin();
  if (!result.ok) {
    throw new Error(result.reason === "unauthenticated" ? "認証が必要です" : "権限がありません");
  }
  return result.user;
}

/**
 * 認証済み ADMIN ユーザーであることを検証する。
 * 失敗時はリダイレクトする（未認証 → /login、権限なし → /）。
 * proxy.ts と併用する多層防御として使う（レイアウトはキャッシュされ得るため単独の砦にはしない）。
 */
export async function requireAdminPage() {
  const result = await checkAdmin();
  if (!result.ok) {
    redirect(result.reason === "unauthenticated" ? "/login" : "/");
  }
  return result.user;
}

// OAuth / パスワード再発行の戻り先を、環境を跨がずリクエスト元に合わせるための origin。
// これを明示しないと Supabase の Site URL にフォールバックし、環境跨ぎの誤リダイレクト
// （本番なのに localhost へ等）や callback を経由せず未ログインになる不具合が起きる。
// origin ヘッダが無い場合は x-forwarded-proto/host（無ければ host）から組み立てる。
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  return (
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  );
}

/**
 * ソーシャルログイン（OAuth 開始）。
 *
 * signInWithOAuth はサーバーでは自動リダイレクトせず認可 URL を返すだけなので、
 * redirect() でプロバイダへ送る。PKCE の code verifier は @supabase/ssr が
 * Cookie に保存し、戻ってきた /auth/callback の exchangeCodeForSession が消費する。
 * 参考: https://supabase.com/docs/guides/auth/social-login/auth-github
 *
 * プロバイダごとの違い（GitHub は OAuth 2.0・Google は OpenID Connect）は Supabase の中で
 * 吸収されるので、アプリ側は provider の文字列が変わるだけになる。
 */
export async function startOAuth(provider: "github" | "google") {
  const origin = await getRequestOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}${routes.auth.callback}` },
  });

  if (error || !data.url) {
    redirect(routes.auth.error);
  }
  redirect(data.url);
}
