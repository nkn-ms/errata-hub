import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Footer } from "@/components/footer";
import { site } from "@/constants/site";
import { THEME_INIT_SCRIPT } from "@/utils/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 等幅は管理画面だけで使う（ISBN・監査ログ・メールドメイン等の `font-mono`）。
// next/font は宣言した場所を基準に preload を張るので、ルートレイアウトで既定のまま宣言すると
// **等幅を一度も使わない公開ページでもフォントファイルを先読みしてしまう**（実測 26KB/ページ）。
// preload だけ切り、CSS 変数はサイト全体に残す（globals.css の --font-mono がこれを参照している。
// 宣言ごと admin レイアウトへ移すと、公開ページで font-mono を書いた瞬間に無言で別フォントに落ちる）。
// 管理画面では初回描画時に読み込まれる＝ここだけ切り替わりが一瞬見えるが、運用画面なので許容する。
// 出典: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md §preload / §Preloading
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Errata Hub",
  description: site.description,
  // ⚠️ 公開前の検索インデックス除外（一時的）。public 化時にこの robots 行と
  // app/robots.ts を削除すること。
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CSP の nonce（src/proxy.ts が発行）。Next.js は自分が出力する <script> には nonce を
  // 自動で付けるが、下のテーマ初期化スクリプトは自前の <script> なので対象外＝ここで渡す。
  //
  // ⚠️ headers() を読むため、このレイアウトを含む全ページが動的レンダリングになる
  //    （静的に生成された HTML には nonce を差し込めず、strict-dynamic 下では
  //    スクリプトが全部ブロックされるので、nonce 方式ではこれが必須）。
  //    トレードオフの詳細は docs/design.md §7「セキュリティヘッダ」。
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="ja"
      // 既定はライト。ダークの人には下の初期化スクリプトが描画前に書き替える。
      // suppressHydrationWarning はその書き替えを React に受け入れさせるため（属性だけが対象で、
      // 中身の照合は効いたまま）= node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 最初の描画より前に同期実行してテーマを確定させる（ちらつき防止）。判定は utils/theme.ts */}
        <script
          nonce={nonce}
          // ブラウザは CSP を処理した後 nonce 属性の値を DOM から隠す（nonce の盗み見を
          // 防ぐ仕様）。そのため React のハイドレーション照合では「サーバー=値あり／
          // クライアント=空」で必ず不一致になる。nonce の実体はブラウザ内部に残っていて
          // 動作に影響しないので、この要素だけ照合を止める（実測: 付けないと dev の
          // コンソールに hydration 警告が毎回出る）。
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
        {/* Vercel Web Analytics（Cookieレス）。プライバシーポリシー第5条2項と対応。 */}
        <Analytics />
        {/* Vercel Speed Insights（実ユーザーの Core Web Vitals 計測）。 */}
        <SpeedInsights />
      </body>
    </html>
  );
}
