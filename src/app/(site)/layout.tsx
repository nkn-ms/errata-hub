import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";

// 公開側（admin でない側）のうち、ヘッダーがページのデータに依存しないページの共通レイアウト。
// 枠（背景・共通ヘッダー・本文の幅）はここが持つので、配下のページは中身だけを書く。
//
// ⚠️ (site) は括弧付き＝ルートグループなので URL には出ない（/tech は /tech のまま）。
//
// ここに入れていないもの:
// - パンくずが要るページ（/books/[isbn]・/reports/[id]・/users/[id]・/account）
//   → 書名や投稿タイトルはページのデータで、layout からは見えないので各ページが SiteShell を描く
// - /login・/register・/auth/*・退会フロー
//   → フォームに集中させるため意図的にヘッダーを持たない（= decision: ヘッダー無しが正）
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
