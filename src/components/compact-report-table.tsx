import Link from "next/link";
import { Report } from "@/types/report";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/report-status";
import { TYPE_LABELS, TYPE_COLORS } from "@/constants/report-labels";
import { routes } from "@/constants/routes";
import { formatRelativeJst } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Badge, getLocationLabel, getErrataLabel } from "@/components/report-card";

// トップ用に列を削ぎ落としたテーブル（11列→6列）。フィード版の対案。
// サーバー描画・?page=N ページネーション（page.tsx 側）と組み合わせる想定。
//
// 落とした列と行き先:
//   版・刷   → 「位置」セルに統合（"第1版 p.42"）
//   タイトル → 「内容」に統合（誤→正・content が本体。タイトルはノイズになりがちで詳細で見せる）
//   出版社コメント / 投稿者 → 詳細ページ（/reports/[id]）と全件テーブル（/reports）に温存
//   賛同     → 「投稿」セルに 👍n を同居
// 残す6列: 種別 / 書籍 / 内容 / 位置 / 状況 / 投稿（日付＋賛同）

// 版と位置を1セルに圧縮（"第1版 p.42" / "電子書籍 位置No.500（43%付近）"）
function compactLocation(r: Report): string {
  const edition = r.edition ? `第${r.edition}版` : null;
  return [edition, getLocationLabel(r)].filter(Boolean).join(" ");
}

export function CompactReportTable({ data }: { data: Report[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3 whitespace-nowrap">種別</th>
            <th className="px-4 py-3">書籍</th>
            <th className="px-4 py-3">内容</th>
            <th className="px-4 py-3 whitespace-nowrap">位置</th>
            <th className="px-4 py-3 whitespace-nowrap">状況</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">投稿</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((r) => (
            // 行全体をクリック可能にする（書籍セルの Link を疑似要素で行いっぱいに広げる stretched link）。
            // JS 不要でサーバー描画のまま行リンクにできる。
            <tr key={r.id} className="relative hover:bg-blue-50 transition-colors">
              <td className="px-4 py-3 align-top">
                <Badge label={TYPE_LABELS[r.type]} className={cn(TYPE_COLORS[r.type], "whitespace-nowrap")} />
              </td>
              <td className="px-4 py-3 align-top">
                <Link
                  href={routes.report(r.id)}
                  className="text-sm font-medium text-gray-900 hover:underline after:absolute after:inset-0 after:content-['']"
                >
                  {r.bookTitle}
                </Link>
              </td>
              <td className="px-4 py-3 align-top">
                <div className="text-sm text-gray-700 line-clamp-1 max-w-md">{getErrataLabel(r)}</div>
              </td>
              <td className="px-4 py-3 align-top text-xs text-gray-500 whitespace-nowrap">
                {compactLocation(r)}
              </td>
              <td className="px-4 py-3 align-top">
                {r.status === "PENDING" ? (
                  <span className="text-xs text-gray-400 whitespace-nowrap">{STATUS_LABELS[r.status]}</span>
                ) : (
                  <Badge
                    label={STATUS_LABELS[r.status]}
                    className={cn(STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700", "whitespace-nowrap")}
                  />
                )}
              </td>
              <td className="px-4 py-3 align-top text-right text-xs text-gray-400 whitespace-nowrap">
                {r.upvoteCount > 0 && <div className="text-gray-500">👍 {r.upvoteCount}</div>}
                <div>{formatRelativeJst(r.createdAtIso)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
