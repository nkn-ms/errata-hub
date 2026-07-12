import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * 認可判定のコア。Supabase の認証ユーザーと ADMIN ロールを確認する。
 * 失敗モード（未認証 / 権限なし）を呼び出し側に委ねるため、ここでは投げず判定結果だけ返す。
 */
async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" as const, user: null };

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { role: true } });
  if (profile?.role !== "ADMIN") return { ok: false as const, reason: "forbidden" as const, user };

  return { ok: true as const, user };
}

/**
 * 認証済み ADMIN ユーザーであることを検証する。
 * API Route 用: { user, error } を返す（error は Response オブジェクト）。
 */
export async function requireAdmin() {
  const result = await checkAdmin();
  if (!result.ok) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    const message = result.reason === "unauthenticated" ? "認証が必要です" : "権限がありません";
    return { user: result.user, error: Response.json({ error: message }, { status }) };
  }
  return { user: result.user, error: null };
}

/**
 * 認証済み ADMIN ユーザーであることを検証する。
 * Server Actions 用: 失敗時は throw し、成功時は監査ログ用に user を返す。
 */
export async function requireAdminOrThrow() {
  const result = await checkAdmin();
  if (!result.ok) {
    throw new Error(result.reason === "unauthenticated" ? "認証が必要です" : "権限がありません");
  }
  return result.user;
}

/**
 * 認証済み ADMIN ユーザーであることを検証する。
 * サーバーコンポーネント（ページ / レイアウト）用: 失敗時はリダイレクトする。
 * proxy.ts と併用する多層防御として使う（レイアウトはキャッシュされ得るため単独の砦にはしない）。
 */
export async function requireAdminPage() {
  const result = await checkAdmin();
  if (!result.ok) {
    redirect(result.reason === "unauthenticated" ? "/login" : "/");
  }
  return result.user;
}
