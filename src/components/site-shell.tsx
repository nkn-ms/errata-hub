import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { PAGE_CONTAINER } from "@/constants/layout";

// 公開側（admin でない側）の枠。背景・共通ヘッダー・本文の幅をここだけが知っている。
//
// なぜ layout.tsx 本体ではなくコンポーネントなのか: 枠を使う場所が2つあるため。
//   1. app/(site)/layout.tsx … 公開側の全ページ
//   2. app/not-found.tsx    … 404。ルートに置く必要があり (site) の layout を受け取れない
//      （not-found は「定義した階層のレイアウト」の中で描かれる仕様で、未一致 URL 全体を
//       受け持てるのはルートの not-found だけ
//       = node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md）
//
// ⚠️ 枠のクラスをこのファイルの外に書き足さないこと。ページごとに枠を持っていた頃は
//    画面を移動すると本文の左端が左右に動いていた（それを1か所に寄せた経緯 = constants/layout.ts）。
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className={`${PAGE_CONTAINER} py-8`}>{children}</main>
    </div>
  );
}
