import { createClient } from "@supabase/supabase-js";

/**
 * secret キー（旧 service_role の後継）を使う管理者用 Supabase クライアント。
 *
 * ⚠️ サーバー専用。secret キーは RLS を貫通する全権キーなので、
 * 絶対にクライアント（ブラウザ）へ渡してはいけない（NEXT_PUBLIC_ を付けない）。
 * 用途は2系統（2026-08-01 時点の実測）:
 *   - Storage の操作 … 投稿画像のアップロードと削除（バケットは非公開の書き込み権限）。呼び出しの大半はこちら
 *   - auth の操作   … 退会時に auth.users を物理削除する（services/withdrawal.ts）
 * 新 API キー（sb_secret_…）は旧 service_role JWT と違い個別にローテーション・失効でき、
 * 漏洩時に該当キーだけを無効化できる（出典: Supabase – Migrating to new API keys）。
 *
 * セッションは持たない（autoRefreshToken/persistSession=false）。毎回ステートレスに使う。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定です（退会など admin 操作に必要）",
    );
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
