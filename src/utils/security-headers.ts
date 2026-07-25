// ⚠️ ここだけ相対 import なのは、このファイルを next.config.ts からも読むため
//    （next.config の読み込みでは tsconfig の "@/" エイリアスが効かない）。
import { ALLOWED_COVER_HOSTS } from "./cover-image";

// セキュリティ関連のレスポンスヘッダを1か所に集める。付け方は2系統に分かれる:
//   - 値が固定のもの（nosniff・Referrer-Policy 等）→ next.config.ts の headers() が全応答に付ける
//   - CSP はリクエストごとの nonce を含むので proxy.ts が付ける（ここは文字列の組み立てだけ）
//
// ⚠️ Vercel が既に付けているヘッダはここに書かない（重複・弱化を避ける）。
//    実測（2026-07-26 / curl -I https://errata-hub.vercel.app ）で付いていたのは:
//      strict-transport-security: max-age=63072000; includeSubDomains; preload
//    ＝ HSTS はプラットフォーム任せでよい。逆にここで短い max-age を書くと弱くなる。

/** 値が固定のセキュリティヘッダ。next.config.ts の headers() から全ルートに付ける */
export const STATIC_SECURITY_HEADERS = [
  // MIME スニッフィング禁止。Supabase Storage の画像や JSON を「HTML かも」と解釈されるのを防ぐ
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 遷移先に渡すリファラを「別オリジンへはオリジンだけ」に制限する。
  // 投稿詳細の URL にはパスしか入らないが、?page= 等のクエリを外部サイトに漏らさない意味がある
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // クリックジャッキング対策。CSP の frame-ancestors 'none' と二重だが、
  // CSP を解さない古いブラウザ向けの保険として残す
  { key: "X-Frame-Options", value: "DENY" },
  // 別オリジンから window.opener 経由で参照されないようにする（タブナビング対策）。
  // GitHub ログインはポップアップではなく全画面リダイレクトなので影響しない
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // 使っていない強い権限は明示的に閉じる（画像添付の <input type="file"> は権限を要求しない）
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
] as const;

type CspOptions = {
  /** リクエストごとに発行する nonce（proxy.ts が生成） */
  nonce: string;
  /** 開発サーバーか。dev だけ必要な緩和（eval・HMR の WebSocket）を足すため */
  isDev: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL。ブラウザが直接叩く先（認証）と画像の配信元になる */
  supabaseUrl: string | undefined;
  /**
   * Vercel Toolbar（Preview のコメント機能）を許すか。Preview だけ true にする。
   * Vercel が Preview の HTML に vercel.live のスクリプトと iframe を差し込むため、
   * 許さないと Preview 実機確認のたびにコンソールに CSP 違反が出てコメント機能も使えない
   * （本番には差し込まれないので、本番のポリシーは緩めない）。
   */
  allowVercelToolbar: boolean;
};

// Vercel Toolbar が要求するホスト。出典（2026-07-26 時点の公式ドキュメント）:
//   https://vercel.com/docs/vercel-toolbar/managing-toolbar#using-a-content-security-policy
// script-src への https://vercel.live は載せていない: strict-dynamic があるとホスト許可リストは
// 無視される（そしてツールバーのスクリプトは Vercel 側が nonce 付きで差し込むため実測で通る）。
const VERCEL_TOOLBAR = {
  connect: ["https://vercel.live", "wss://ws-us3.pusher.com"],
  img: ["https://vercel.live", "https://vercel.com"],
  style: ["https://vercel.live"],
  font: ["https://vercel.live", "https://assets.vercel.com"],
  frame: ["https://vercel.live"],
} as const;

/** URL 文字列からオリジン（scheme://host:port）だけを取り出す。不正なら null */
function toOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy の値を組み立てる。
 *
 * 方式は nonce ＋ strict-dynamic（Next.js 公式の推奨形）。
 *   出典: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 *
 * ⚠️ この方式は全ページの動的レンダリングを要求する（静的に生成された HTML には
 *    nonce を差し込めず、strict-dynamic 下ではスクリプトが全部ブロックされる）。
 *    そのため app/layout.tsx が headers() を読んで全ルートを動的にしている。
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
  supabaseUrl,
  allowVercelToolbar,
}: CspOptions): string {
  const supabaseOrigin = toOrigin(supabaseUrl);
  /** Vercel Toolbar 用のホストを足すヘルパ（Preview 以外では何も足さない） */
  const toolbar = (hosts: readonly string[]) => (allowVercelToolbar ? hosts : []);

  const directives: string[] = [
    "default-src 'self'",

    // strict-dynamic は「nonce 付きスクリプトが動的に読み込んだスクリプトも信頼する」指定。
    // これで @vercel/analytics 等の document.createElement("script") 経由の読み込みが
    // ホストを列挙せずに通る（逆にホスト許可リストは無視されるようになる）。
    // 'self' は strict-dynamic を解さない古いブラウザ向けのフォールバックとして残す。
    // dev の 'unsafe-eval' は React が eval でサーバー側スタックを再構成するため必要（本番は不要）。
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,

    // ⚠️ style だけは 'unsafe-inline' を許す。nonce は <style> 要素にしか効かず、
    //    React の style 属性（例: components/book-cover.tsx の aspectRatio）には効かないため、
    //    厳格にすると素の HTML でレイアウトが崩れる。CSS 経由の攻撃は script より影響が小さく、
    //    script-src を厳格に保つ方を優先した判断。
    ["style-src 'self' 'unsafe-inline'", ...toolbar(VERCEL_TOOLBAR.style)].join(" "),

    // 画像だけは外部ホストを明示的に許す。許可ホストは書影の保存時検証と同じ集合を使い回す
    // （utils/cover-image.ts。片方だけ増やして表示が壊れる／検証が緩むのを防ぐ）。
    // blob: は投稿フォームの選択中ファイルのプレビュー、data: は将来の埋め込み画像向け。
    // Supabase オリジンは投稿画像（Storage の公開 URL）の配信元。
    [
      "img-src 'self' data: blob:",
      ...[...ALLOWED_COVER_HOSTS].map((host) => `https://${host}`),
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      ...toolbar(VERCEL_TOOLBAR.img),
    ].join(" "),

    // next/font/google はビルド時に自前ホストへ取り込まれるので外部フォントは不要
    ["font-src 'self'", ...toolbar(VERCEL_TOOLBAR.font)].join(" "),

    // ブラウザから直接叩く外部は Supabase（認証トークンの検証・更新）だけ。
    // Google Books / OpenBD はサーバー側の Route Handler 経由なのでここには要らない。
    // Vercel Analytics / Speed Insights の計測ビーコンは本番では同一オリジン（/_vercel/…）。
    // dev の ws: は Next.js の HMR（'self' が ws を含むかはブラウザ差があるため明示）。
    [
      "connect-src 'self'",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      ...(isDev ? ["ws:"] : []),
      ...toolbar(VERCEL_TOOLBAR.connect),
    ].join(" "),

    // iframe・<object> は自分では一切使わないので閉じる（埋め込み型の攻撃面を無くす）。
    // Preview だけ Vercel Toolbar の iframe を通す
    allowVercelToolbar ? `frame-src ${VERCEL_TOOLBAR.frame.join(" ")}` : "frame-src 'none'",
    "object-src 'none'",
    // <base> の書き換えで相対 URL の解決先を乗っ取られないようにする
    "base-uri 'self'",
    // フォームの送信先を自サイトに限定（注入されたフォームでの入力値の持ち出しを防ぐ）。
    // ⚠️ JS 無効時の GitHub ログインだけは影響を受ける（Server Action の 303 リダイレクト先が
    //    Supabase の認可 URL になるため）。JS 有効時はルーターが遷移するので影響しない。
    "form-action 'self'",
    // 他サイトからの frame 埋め込みを禁止（X-Frame-Options の CSP 版）
    "frame-ancestors 'none'",
  ];

  // http のサブリソースを https に読み替えさせる。ローカル開発では Supabase が
  // http://127.0.0.1:54321 なので付けると壊れる＝本番・Preview だけ。
  if (!isDev) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
