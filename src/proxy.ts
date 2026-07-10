import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() はトークン検証と、失効間際ならリフレッシュ（延長）も行う。
  // その結果を cookie に書き戻せるのは実質ここ（ミドルウェア）だけなので、
  // この呼び出しが「セッション維持」の本体になる（Server Component は cookie を書けない）。
  const { data: { user } } = await supabase.auth.getUser();

  // ミドルウェアはエッジで軽く動くべきなので DB を読まない（ロール判定はしない）。
  // ここでは「ログインしているか」だけを見て未ログインを門前払いする粗いゲート。
  // ADMIN ロールの認可は admin/layout.tsx の requireAdminPage（Prisma）に一本化する。
  const protectedPaths = ["/submit", "/admin"];
  const needsAuth = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  if (!user && needsAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // 静的アセットを除く全ルートで実行する（Supabase 公式推奨の形）。
  // 以前は保護ルート（/admin・/submit）限定だったが、それだと公開ページだけを
  // 閲覧しているログインユーザーのトークン延長が cookie に保存されず、
  // 時間経過で突然ログアウトされ得る（2026-07 監査 2-6 で発見）。
  // コスト面: 未ログイン訪問者は auth cookie が無く getUser() はネットワークを
  // 叩かずに即 null を返すため、匿名アクセスにはほぼ乗らない。
  // パターンの出典: https://supabase.com/docs/guides/auth/server-side/nextjs
  // （否定先読みの解説は node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md の Matcher 節）
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
