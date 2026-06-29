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
  const domain = email.split("@")[1] ?? "";
  const displayName = (data.user.user_metadata?.display_name as string) || null;

  const matchedPublishers = domain
    ? await prisma.publisher.findMany({ where: { emailDomain: domain } })
    : [];

  // role は identity（ADMIN/USER）のみ。出版社かどうかは PublisherAccess から導出するため
  // ここではロールに焼き込まず、下で PublisherAccess を付与する（capability）。
  const profile = await prisma.profile.upsert({
    where: { id: data.user.id },
    update: {},
    create: {
      id: data.user.id,
      email,
      displayName,
      role: "USER",
    },
  });

  if (matchedPublishers.length > 0) {
    await prisma.publisherAccess.createMany({
      data: matchedPublishers.map((p) => ({
        profileId: profile.id,
        publisherId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  // パスワード再発行などで戻り先を指定したい場合に next を使う。
  // オープンリダイレクト対策として、アプリ内の相対パス（/始まり・//除外）のみ許可する。
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return NextResponse.redirect(new URL(safeNext, origin));
}
