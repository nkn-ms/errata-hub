import type { ReactNode } from "react";
import { SiteHeader, type SiteHeaderCrumb } from "@/components/site-header";
import { PAGE_CONTAINER } from "@/constants/layout";

// 公開側ページの枠。「背景 ＋ 共通ヘッダー ＋ 本文の枠」を知っているのはここだけにする
// （以前は全ページが min-h-screen bg-gray-50 と <main> を各々書いていた＝22箇所の重複）。
//
// パンくずが不要なページは app/(site)/layout.tsx がこれを描くので、ページ側は中身だけを書く。
// ⚠️ パンくずが要るページ（書籍・投稿・ユーザー詳細・アカウント設定）は自分でこれを描く。
//    Next.js の layout は配下のページのデータを受け取れず（自分のセグメントの params しか見えない）、
//    書名や投稿タイトルをレイアウト側で知る方法が無いため。
export function SiteShell({
  crumbs,
  sticky,
  children,
}: {
  crumbs?: SiteHeaderCrumb[];
  /** アカウント設定など、追従させたくないページだけ false にする */
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader crumbs={crumbs} sticky={sticky} />

      <main className={`${PAGE_CONTAINER} py-8`}>{children}</main>
    </div>
  );
}
