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

// 等幅は識別子の表示に使う（ISBN・監査ログの ID / JSON・メールドメインの `font-mono`）。
// 桁が揃うと目視で照合できるため、散文（書名・本文）には使わない。
//
// ⚠️ 宣言をここ（ルート）から admin レイアウトへ移してはいけない。globals.css の
//    --font-mono がこの CSS 変数を参照しているので、公開ページで font-mono を書いた瞬間に
//    変数が未定義になり、無言で別フォントに落ちる。
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 絶対 URL が必要な metadata フィールドの基準になるホスト。相対パスで書いたフィールドは
  // ここと合成される。sitemap.ts / robots.ts と同じ「正規の住所」＝ site.url に固定する
  // （env にしない理由は constants/site.ts に書いてある）。
  //
  // ⚠️ 必須。相対パスの metadata フィールドを metadataBase 無しで書くとビルドが落ちる。
  //    各ページが canonical を "/..." と相対で書けているのはこれがあるため。
  //
  // ⚠️ opengraph-image.tsx（ファイル規約）が出す og:image には効かない。そちらの URL は
  //    常にリクエストのホストから組み立てられる（実測: dev は http://localhost:3000/...・
  //    本番は https://errata-hub.vercel.app/... で、パスとハッシュは同一）。
  //    ＝ Preview を共有すると、その Preview 自身の OG 画像が出る。
  //   出典: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md
  //         「metadataBase」の項（"metadata fields that require a fully qualified URL"）
  metadataBase: new URL(site.url),
  title: "Errata Hub",
  description: site.description,
  // Google Search Console の所有権確認（URL プレフィックスプロパティ）。
  // ⚠️ 消すと所有権が失効し、Search Console のデータが見られなくなる。確認後も残し続けること。
  // 値は秘密ではなく公開される目印（全ページの <head> に出る）。
  // ※ vercel.app はドメインを間借りしているため DNS 方式は使えず、この方式を選んでいる。
  verification: {
    google: "CSDEREPOA9nq51Ywk000xDCotcVq_5S9S8qar4gny6s",
  },
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
