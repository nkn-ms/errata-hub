import Link from "next/link";

// 管理画面の一覧は1ページ50件（もともと操作ログだけがこの値で動いていたのを、5画面の共通の値にした）。
// 公開側のトップ（20件）より多いのは、管理者が探しているのは「眺める対象」ではなく特定の1行で、
// 目で追う密度より1画面に入る行数の方が効くため。
export const ADMIN_PAGE_SIZE = 50;

type Props = {
  page: number;
  totalPages: number;
  /** 表示中の範囲（utils/pagination.ts の paginate が返す from / to）と総件数 */
  from: number;
  to: number;
  total: number;
  /** ページ番号から遷移先 URL を作る。絞り込み条件を持つ画面はそれも載せて返すこと */
  href: (page: number) => string;
};

/**
 * 管理画面の一覧の下に出すページ送り。
 *
 * 1ページに収まっているときは何も出さない（1画面しか無い一覧に「1 / 1」は情報を足さない）。
 * ボタンではなく <Link> なのは、戻る・履歴・新しいタブで開くがそのまま効くため。
 */
export function AdminPagination({ page, totalPages, from, to, total, href }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="ページ送り">
      <p className="text-gray-500">
        {from}〜{to} 件目 / 全 {total} 件
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={href(page - 1)}
            rel="prev"
            className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            前へ
          </Link>
        )}
        <span className="px-3 py-1.5 text-gray-600">
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={href(page + 1)}
            rel="next"
            className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            次へ
          </Link>
        )}
      </div>
    </nav>
  );
}
