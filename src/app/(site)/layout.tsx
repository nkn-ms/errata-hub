import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { PAGE_CONTAINER } from "@/constants/layout";

// 公開側（admin でない側）の**全ページ**の枠。背景・共通ヘッダー・本文の幅をここだけが知っている。
// 配下のページは中身だけを書く（以前は全ページが min-h-screen bg-gray-50 と <main> を各々持っていた）。
//
// ⚠️ (site) は括弧付き＝ルートグループなので URL には出ない（/tech は /tech のまま）。
//    URL を変えずに「共通の枠を受け取る範囲」を区切るための記法。
//
// ここに入れていないのは /login・/register・/auth/*・退会フローだけで、これらはフォームに
// 集中させるため意図的にヘッダーを持たない（＝フォルダの外に置くことで構成として表している）。
//
// パンくずは本文側（components/breadcrumbs.tsx）が持つ。ヘッダーに入れるとページごとに中身が
// 変わってしまい、layout は子ページから値を受け取れないためここで描けなくなる。
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className={`${PAGE_CONTAINER} py-8`}>{children}</main>
    </div>
  );
}
