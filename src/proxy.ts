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
  matcher: ["/admin/:path*", "/submit/:path*", "/submit"],
};
