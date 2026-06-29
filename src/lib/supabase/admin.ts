import { createClient } from "@supabase/supabase-js";

/**
 * service_role キーを使う管理者用 Supabase クライアント。
 *
 * ⚠️ サーバー専用。service_role キーは RLS を貫通する全権キーなので、
 * 絶対にクライアント（ブラウザ）へ渡してはいけない（NEXT_PUBLIC_ を付けない）。
 * 用途: 退会時に auth.users を物理削除する等、admin API の呼び出し。
 *
 * セッションは持たない（autoRefreshToken/persistSession=false）。毎回ステートレスに使う。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定です（退会など admin 操作に必要）",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
