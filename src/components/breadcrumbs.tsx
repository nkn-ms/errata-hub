import Link from "next/link";
import { routes } from "@/constants/routes";

// 本文の先頭に置くパンくず。
//
// 以前は共通ヘッダーの帯の中に出していたが、それだと「ヘッダーの中身がページによって変わる」＝
// ヘッダーを layout.tsx に寄せられない（layout は子ページから値を受け取れない）という制約になっていた。
// 本文側へ移したことで、ヘッダーは全ページ完全に同じものになり、副産物として
// **スマホでもパンくずが見えるようになった**（帯の中では幅を取り合って畳んでいた）。
//
// href が無い項目はリンクにしない。中間の「ユーザー」のように一覧ページが存在しない区分や、
// 末尾の現在地がそれに当たる。現在地は aria-current="page" で支援技術にも伝える。
export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="パンくず" className="mb-4">
      {/* ol にするのは順序に意味があるため（階層の上→下）。読み上げでも件数と順番が伝わる */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
        <li className="flex items-center gap-x-2">
          <Link href={routes.home} className="text-blue-600 hover:underline">
            トップ
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-x-2">
              {/* 区切りの装飾。階層はリストの並びが表しているので読み上げからは隠す */}
              <span aria-hidden className="text-gray-400">
                /
              </span>
              {item.href ? (
                <Link href={item.href} className="truncate text-blue-600 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="truncate text-gray-600"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
