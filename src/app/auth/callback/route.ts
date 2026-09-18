/**
 * 認証コールバックルート
 *
 * PKCE (RFC 7636: https://www.rfc-editor.org/rfc/rfc7636) に基づく認可コードフロー
 * exchangeCodeForSession() で code をセッションに交換する
 * code は1回限り有効・5分で失効
 * 参考: https://supabase.com/docs/guides/auth/sessions/pkce-flow
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/constants/legal";
import { toDisplayName } from "@/features/account/utils/display-name";
import { ensureProfile } from "@/features/account/db/profile";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", origin));
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/error", origin));
  }

  const email = data.user.email ?? "";
  // メール登録は display_name（register で設定）。OAuth（GitHub 等）には display_name が
  // 無いので、プロバイダ由来の氏名（full_name）→アカウント名（user_name）の順で補う。
  const meta = data.user.user_metadata ?? {};
  const displayName =
    toDisplayName(meta.display_name) ??
    toDisplayName(meta.full_name) ??
    toDisplayName(meta.user_name);

  // Profile が無ければ作る（理由と失敗時の扱いは features/account/db/profile.ts）。
  const result = await ensureProfile({
    id: data.user.id,
    email,
    displayName,
    termsVersion: TERMS_VERSION,
  });
  if (!result.ok) {
    // ここで 500 にすると、直前の exchangeCodeForSession でセッションだけは張られているので
    // 「ログインできるが Profile が無い」壊れた状態が残る。Profile を作る経路はこの callback だけ
    // （パスワードログインは通らない）＝以後のログインでも自然回復しないため、セッションを畳んで
    // エラーページに落とし、運営の手作業（旧 Profile の整理）に委ねる。
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`/auth/error?reason=${result.reason}`, origin));
  }

  // パスワード再発行などで戻り先を指定したい場合に next を使う。
  // オープンリダイレクト対策として、アプリ内の相対パス（/始まり・//除外）のみ許可する。
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return NextResponse.redirect(new URL(safeNext, origin));
}
