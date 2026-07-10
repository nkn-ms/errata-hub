import { createBrowserClient } from "@supabase/ssr";

// Supabase SSR クライアント（ブラウザ用）。公式パターンそのまま。
// 出典: https://supabase.com/docs/guides/auth/server-side/nextjs
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
