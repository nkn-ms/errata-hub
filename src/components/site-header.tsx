import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

// コンテンツ幅はページ種別ごとに異なる（一覧・静的ページ=2xl / 詳細=lg / アカウント設定=md）。
// 各ページの <main> 側の幅クラスと揃えること（ヘッダーだけ幅が違うと縦のラインがずれる）。
const WIDTH_CLASSES = {
  "2xl": "max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8",
  lg: "max-w-screen-lg mx-auto px-4 sm:px-6",
  md: "max-w-screen-md mx-auto px-4 sm:px-6",
} as const;

// パンくず1項目。href があれば書籍詳細などへのリンク、なければ現在地の表示のみ。
export type SiteHeaderCrumb = {
  label: string;
  href?: string;
};

type SiteHeaderProps = {
  width?: keyof typeof WIDTH_CLASSES;
  /** アカウント設定など、追従させたくないページだけ false にする */
  sticky?: boolean;
  /** トップページ自身ではロゴを自己リンクにしない（現在地なので） */
  logoAsLink?: boolean;
  crumbs?: SiteHeaderCrumb[];
  /** 右端に置くアクション（ナビ・CTA リンク等） */
  children?: ReactNode;
};

// 一般ページ共通ヘッダー。管理画面（app/admin/layout.tsx）は配色・ナビが別物なので対象外。
export function SiteHeader({
  width = "2xl",
  sticky = true,
  logoAsLink = true,
  crumbs,
  children,
}: SiteHeaderProps) {
  return (
    <header className={`bg-white border-b border-gray-200${sticky ? " sticky top-0 z-10" : ""}`}>
      <div className={`${WIDTH_CLASSES[width]} h-14 flex items-center gap-4`}>
        {logoAsLink ? (
          <Link
            href={routes.home}
            className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            {site.name}
          </Link>
        ) : (
          <span className="text-lg font-bold text-gray-900">{site.name}</span>
        )}

        {crumbs?.map((crumb) => (
          <Fragment key={crumb.label}>
            <span className="text-gray-300">/</span>
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

        {children ? <div className="ml-auto flex items-center">{children}</div> : null}
      </div>
    </header>
  );
}
