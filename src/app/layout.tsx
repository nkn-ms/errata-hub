import type { Metadata } from "next";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Errata Hub",
  description: site.description,
  // ⚠️ 公開前の検索インデックス除外（一時的）。public 化時にこの robots 行と
  // app/robots.ts を削除すること。
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
