import { Fragment } from "react";
import Link from "next/link";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderNav } from "@/components/header-nav";
import { getHeaderUser } from "@/lib/header-user";
import { PAGE_CONTAINER } from "@/constants/layout";

// パンくず1項目。href があれば書籍詳細などへのリンク、なければ現在地の表示のみ。
export type SiteHeaderCrumb = {
  label: string;
  href?: string;
};

type SiteHeaderProps = {
  /** アカウント設定など、追従させたくないページだけ false にする */
  sticky?: boolean;
  /** トップページ自身ではロゴを自己リンクにしない（現在地なので） */
  logoAsLink?: boolean;
  crumbs?: SiteHeaderCrumb[];
};

// 一般ページ共通ヘッダー。管理画面（app/admin/layout.tsx）は配色・ナビが別物なので対象外。
//
// ナビ（HeaderNav）はこのコンポーネントが自分で出す。ページから children で渡せるようにすると
// 「トップと /reports だけナビ、/how-to-use は投稿するだけ、詳細ページは何も無し」のように
// 画面ごとに中身がばらけ、利用者はヘッダーに何があるか覚えられない。渡す口を無くすことで
// 「どのページでも同じ中身」をページ側の書き忘れに依存せず構造で保証する。
//
// ⚠️ ナビの表示にはログイン状態が要るので、この共通ヘッダーを出す全ページで
//    getHeaderUser()（Supabase の getUser ＋ Profile 1件）が走る。CSP nonce の都合で
//    どのページも既に動的レンダリングなので、静的化を壊してはいない。
export async function SiteHeader({
  sticky = true,
  logoAsLink = true,
  crumbs,
}: SiteHeaderProps) {
  const { userName, isAdmin } = await getHeaderUser();

  return (
    <header className={`bg-white border-b border-gray-200${sticky ? " sticky top-0 z-10" : ""}`}>
      <div className={`${PAGE_CONTAINER} h-14 flex items-center gap-4`}>
        {/* ロゴとナビは縮めない（shrink-0）。詰まったときに縮む・切れるのはパンくずの側で、
            そうしないと「Errata Hub」や「投稿する」が2〜3行に折り返してヘッダーが崩れる */}
        {logoAsLink ? (
          <Link
            href={routes.home}
            className="shrink-0 whitespace-nowrap text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            {site.name}
          </Link>
        ) : (
          <span className="shrink-0 whitespace-nowrap text-lg font-bold text-gray-900">
            {site.name}
          </span>
        )}

        {/* sm 未満はパンくずを畳む。ナビ＋主 CTA と幅を取り合うと文字が全部 truncate され、
            区切りの「/」だけが残って意味を失う。詳細ページはいずれも本文側に戻り導線
            （書籍リンク・「← 一覧へ戻る」）を持っているので、経路は失われない */}
        {crumbs && (
          <div className="hidden sm:flex min-w-0 items-center gap-4">
            {crumbs.map((crumb) => (
              <Fragment key={crumb.label}>
                {/* 区切りの装飾。読み上げでは「スラッシュ」がノイズになるだけで、
                    階層はリンクの並びが表しているので隠す（＝コントラスト基準の対象外にもなる） */}
                <span aria-hidden className="shrink-0 text-gray-300">
                  /
                </span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-sm text-blue-600 hover:underline truncate max-w-xs"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500 truncate max-w-xs">{crumb.label}</span>
                )}
              </Fragment>
            ))}
          </div>
        )}

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
