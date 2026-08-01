import Link from "next/link";

// 404 の本文。公開側（app/not-found.tsx）と管理画面（app/admin/not-found.tsx）で共有する。
// 枠（ヘッダー・背景・幅）は呼び出し側のレイアウトが持つので、ここは中身だけを描く。
//
// 文言と戻り先を呼び出し側から渡すのは、読者が次に取れる行動が側で違うため
// （公開側＝トップ／管理画面＝投稿一覧）。見た目だけをここで揃える。
//
// 戻り先を1つに絞っているのは、選択肢を増やしても行き先が実質同じだったため。
// 当初は公開側に「トップへ」と「投稿を検索する」を並べていたが、トップの検索ボックスが
// /reports?q= へ委譲する作りなので、2つ目は1手先に含まれていた。

export function NotFoundContent({
  message,
  action,
}: {
  message: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      {/* 「404」は見出しではなく符号なので h1 にしない（読み上げでは下の見出しが本題）。
          数字だけを大きく出す装飾はしない = 状態を伝える文が主役 */}
      <p className="text-sm font-medium text-gray-500">404</p>
      <h1 className="mt-2 text-xl font-bold text-gray-900">ページが見つかりません</h1>
      <p className="mt-3 text-sm text-gray-600">{message}</p>

      <div className="mt-6">
        <Link
          href={action.href}
          className="block w-full rounded-md bg-gray-900 py-2 text-sm text-white transition-colors hover:bg-gray-700"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
