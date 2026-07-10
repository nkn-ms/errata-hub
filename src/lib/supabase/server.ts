import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase SSR クライアント（サーバー用）。cookie の getAll/setAll の形と、
// Server Component では cookie を書けないため setAll の失敗を握りつぶす try/catch は
// 公式パターンそのまま。出典: https://supabase.com/docs/guides/auth/server-side/nextjs
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Componentから呼ばれた場合は無視
          }
        },
      },
    }
  );
}
