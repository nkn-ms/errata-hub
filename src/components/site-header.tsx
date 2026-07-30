import Link from "next/link";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderNav } from "@/components/header-nav";
import { getHeaderUser } from "@/lib/header-user";
import { PAGE_CONTAINER } from "@/constants/layout";

// 公開側の共通ヘッダー。管理画面（app/admin/layout.tsx）は配色・ナビが別物なので対象外。
//
// **props を取らない**＝どのページでも中身が完全に同じ。これは意図した制約で、
// ページから渡せる口があると「トップと /reports だけナビ、/how-to-use は投稿するだけ」のように
// 画面ごとにばらけ、利用者はヘッダーに何があるか覚えられなくなる（実際そうなっていた）。
// パンくずも本文側（components/breadcrumbs.tsx）に置いており、ここには持ち込まない。
// この形なので app/(site)/layout.tsx が全ページ分のヘッダーを1回だけ描ける。
//
// ⚠️ ナビの表示にはログイン状態が要るので、このヘッダーを出す全ページで
//    getHeaderUser()（Supabase の getUser ＋ Profile 1件）が走る。CSP nonce の都合で
//    どのページも既に動的レンダリングなので、静的化を壊してはいない。
export async function SiteHeader() {
  const { userName, isAdmin } = await getHeaderUser();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className={`${PAGE_CONTAINER} h-14 flex items-center gap-4`}>
        {/* ロゴとナビは縮めない（shrink-0）。「Errata Hub」や「投稿する」が2〜3行に
            折り返すとヘッダーの高さごと崩れるため。
            トップに居るときもリンクのままにする（?page=N から1ページ目へ戻れる導線になるため） */}
        <Link
          href={routes.home}
          className="shrink-0 whitespace-nowrap text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors"
        >
          {site.name}
        </Link>

        {/* 右端はテーマ切り替え＋ナビ。どちらも全ページ共通で、ここで一度だけ置く
            （管理画面の帯は配色が別物なので対象外＝globals.css の注記参照）。 */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <HeaderNav userName={userName} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
