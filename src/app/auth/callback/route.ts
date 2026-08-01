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
import { prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/constants/legal";
import { Prisma } from "@/generated/prisma/client";

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
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.user_name as string) ||
    null;

  // role は identity（ADMIN/USER）のみ。出版社かどうかは PublisherAccess から導出する（capability）。
  //
  // ⚠️ ここでは出版社アクセスを一切付けない。以前は Publisher.emailDomain とメールのドメイン部を
  //    突き合わせて自動付与していたが、**人の判断を経ない常時付与**になるため廃止した
  //    （退職者・大企業の無関係な人・後からそのドメインのアドレスを取得した人にも付いてしまう。
  //     一般的な auto-join 機能は DNS でドメイン所有を証明させるが、ここにはその仕組みが無い）。
  //    付与は管理画面のユーザー編集からの個別付与だけ = actions/user.ts の grantPublisherAccess。
  //
  // 規約への同意は Profile 作成時（＝このサービスを初めて使う瞬間）にだけ刻む。update:{} なのは
  // 「同意したのはこの版・この時点」という事実を後のログインで上書きしないため。
  try {
    await prisma.profile.upsert({
      where: { id: data.user.id },
      update: {},
      create: {
        id: data.user.id,
        email,
        displayName,
        role: "USER",
        termsAgreedAt: new Date(),
        termsVersion: TERMS_VERSION,
      },
    });
  } catch (e) {
    // upsert は id（＝auth の UUID）で判定するので、退会を経ずに auth ユーザーだけを消して
    // 同じメールで登録し直すと、旧 Profile が email（@unique）を握ったまま create に進んで
    // P2002 になる（正規の退会なら email は deleted-<uuid>@deleted.local にスクラブ済みで衝突しない）。
    // 詳細は docs/learnings.md「落とし穴：同じメールで再登録すると壊れる」。
    //
    // ここで throw すると 500 になり、しかも直前の exchangeCodeForSession でセッションだけは
    // 張られているので「ログインできるが Profile が無い」壊れた状態が残る。Profile を作る経路は
    // この callback だけ（パスワードログインは通らない）＝以後のログインでも自然回復しないため、
    // セッションを畳んでエラーページに落とし、運営の手作業（旧 Profile の整理）に委ねる。
    console.error(e);
    const isEmailConflict =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${isEmailConflict ? "email-conflict" : "profile"}`, origin)
    );
  }

  // パスワード再発行などで戻り先を指定したい場合に next を使う。
  // オープンリダイレクト対策として、アプリ内の相対パス（/始まり・//除外）のみ許可する。
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return NextResponse.redirect(new URL(safeNext, origin));
}
