import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Supabase の認証 Cookie に足すオプション。サーバー用クライアント（server.ts）と
 * ミドルウェア（proxy.ts）の両方で同じ値を使う（片方だけ守っても意味が無いため1か所に置く）。
 *
 * **httpOnly: true = セッショントークンを JavaScript から読めなくする。**
 * XSS を防ぐものではなく、成立してしまった後の被害を限定する壁（CSP=予防／これ=被害限定の二段構え）。
 * これが無いと `document.cookie` から `sb-*-auth-token` が読めるため、XSS 1回で
 * アカウント乗っ取りまで届く。
 *
 * `@supabase/ssr` の既定は **httpOnly: false**（`DEFAULT_COOKIE_OPTIONS` に明示されている）。
 * これはブラウザ側クライアント（`createBrowserClient`）が `document.cookie` からセッションを
 * 読む構成を想定した既定値で、**このアプリはサーバー経由でしか Supabase を触らない**
 * （ブラウザ用クライアントは置いていない）ため不要 ＝ 塞ぐ。
 * トークンの検証と更新は proxy.ts の `getUser()` が担っており、ブラウザ側で読む必要はない。
 *
 * ⚠️ 将来ブラウザから Supabase を直接使う機能（Realtime・クライアントから Storage への
 *    直アップロード等）を入れるときは、この判断の見直しが必要になる。
 *
 * **secure: true = HTTPS でしか送らない**。`@supabase/ssr` の既定には入っていない。
 * 本番は HSTS（Vercel が `max-age=63072000; includeSubDomains; preload` を付けている）で
 * http アクセス自体が起きないため実利は小さいが、付けない理由も無いので明示する。
 * ⚠️ ローカルは http なので開発時は false でなければログインできない。判定は NODE_ENV で行う
 *    （`next start` を http でローカル実行するときだけは付いてしまう点に注意）。
 *
 * sameSite / path / maxAge は既定のまま（sameSite=lax が CSRF 対策の主役）。
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
