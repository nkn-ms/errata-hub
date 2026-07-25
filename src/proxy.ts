import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/utils/security-headers";

export async function proxy(request: NextRequest) {
  // CSP の nonce はリクエストごとに使い捨て（推測されないことが安全性の前提）。
  // 生成方法は Next.js 公式の例と同じ（UUID を base64 化。パディングの = は付かない）:
  //   node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  // Next.js は「リクエストの CSP ヘッダ」から nonce を読み取り、自分が出力する
  // <script>（フレームワーク・ページのバンドル・RSC ペイロード）に自動で付ける。
  // なので応答だけでなくリクエストにも同じ値を載せる必要がある（公式手順の2番目）。
  // x-nonce は app/layout.tsx の自前 inline スクリプト（テーマ初期化）用。
  // 関数にしているのは、下の setAll で cookie を書き換えた「後」の request を元に
  // 作り直す必要があるため（Headers のコピーを取る時点が変わると cookie が古くなる）。
  const nextWithNonce = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let supabaseResponse = nextWithNonce();

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
          supabaseResponse = nextWithNonce();
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
    return withCsp(NextResponse.redirect(new URL("/login", request.url)), csp);
  }

  return withCsp(supabaseResponse, csp);
}

/** 応答に CSP を付ける。返す経路が複数あるので付け忘れを防ぐために関数にしている */
function withCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  return response;
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
  //
  // ⚠️ CSP もここで付けるので、除外したパスには CSP が付かない。除外しているのは
  //    静的アセット（画像・_next/static）だけで、HTML を返すルートは全て通る。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
