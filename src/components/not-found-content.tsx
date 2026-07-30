import Link from "next/link";

// 404 の本文。公開側（app/not-found.tsx）と管理画面（app/admin/not-found.tsx）で共有する。
// 枠（ヘッダー・背景・幅）は呼び出し側のレイアウトが持つので、ここは中身だけを描く。
//
// 文言を呼び出し側から渡すのは、読者が次に取れる行動が側で違うため
// （公開側＝投稿を探す／管理画面＝一覧に戻る）。見た目だけをここで揃える。

export type NotFoundAction = {
  href: string;
  label: string;
};

export function NotFoundContent({
  message,
  actions,
}: {
  message: string;
  // 先頭を主ボタン、以降を副ボタンとして描く（行動の優先順位を呼び出し側が並び順で表す）
  actions: NotFoundAction[];
}) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      {/* 「404」は見出しではなく符号なので h1 にしない（読み上げでは下の見出しが本題）。
          数字だけを大きく出す装飾はしない = 状態を伝える文が主役 */}
      <p className="text-sm font-medium text-gray-500">404</p>
      <h1 className="mt-2 text-xl font-bold text-gray-900">ページが見つかりません</h1>
      <p className="mt-3 text-sm text-gray-600">{message}</p>

      <div className="mt-6 flex flex-col gap-2">
        {actions.map((action, i) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              i === 0
                ? "block w-full rounded-md bg-gray-900 py-2 text-sm text-white transition-colors hover:bg-gray-700"
                : "block w-full rounded-md border border-gray-300 py-2 text-sm transition-colors hover:bg-gray-50"
            }
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
