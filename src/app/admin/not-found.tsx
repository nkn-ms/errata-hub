import { NotFoundContent } from "@/components/not-found-content";
import { routes } from "@/constants/routes";

// 管理画面の 404。notFound() の呼び出しは admin 側にも4か所ある
// （/admin/reports/[id]・/admin/books/[id]・/admin/publishers/[id]・/admin/users/[id]）。
//
// なぜ公開側（app/not-found.tsx）と別に置くのか: not-found は「定義した階層のレイアウト」の中で
// 描かれるため、これが無いと管理者がルートの 404 に落ち、**公開側のヘッダー**が出て
// 管理画面のナビを失う（戻り先が分からなくなる）。ここに置けば admin/layout.tsx の帯が残る。
// 枠は admin/layout.tsx が持つので、この画面は中身だけを描く。
export default function AdminNotFound() {
  return (
    <NotFoundContent
      message="指定された項目は見つかりませんでした。削除されたか、URL が正しくない可能性があります。"
      actions={[{ href: routes.admin.reports, label: "投稿一覧へ" }]}
    />
  );
}
