"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { SelectField } from "@/components/ui/select-field";
import { Report, ReportType, ReportStatus } from "@/features/report/types";
import { STATUS_LABELS } from "@/features/report/constants/report-status";
import { TYPE_LABELS, TYPE_COLORS } from "@/features/report/constants/report-labels";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { latestPublisherComment, publisherCommentLabel } from "@/features/report/utils/publisher-comment";
import {
  Badge,
  ReportCard,
  getEditionLocationLabel,
  ErrataSummary,
} from "@/features/report/components/report-card";
import { StatusBadge } from "@/features/report/components/report-status-badge";

// 列は6つ。以前は11列あり、1280px でも 224px 分が横スクロールの向こう側に隠れていた
// （＝隠れた列は誰も読まないのに、全部の列幅を細くして読みにくさだけを配っていた）。
// 落とした情報は捨てずに同じ意味のセルへ寄せてある。トップの CompactReportTable と同じ並び。
//
//   版・刷        → 「位置」に統合（"第1版 第2刷 p.42"）
//   タイトル      → 「内容」の2行目に統合（主役は誤→正・内容の方）
//   出版社コメント → 「状況」に統合（ステータスと出版社の回答は同じ話）
//   賛同・投稿者   → 「投稿」に統合（日付と同じ「誰がいつ」の情報）
//
// 検索（globalFilter）の対象は列を絞る前と同じに保つため、隠し列 searchText にまとめている。
const columns: ColumnDef<Report>[] = [
  {
    // 表示しない検索用の列。TanStack の globalFilter は「accessorFn を持つ列」を見るだけで
    // 表示状態は問わないので、隠し列でも検索対象になる（table-core: getCanGlobalFilter）。
    // これが無いと、列を落とした瞬間にその項目で検索できなくなる
    id: "searchText",
    accessorFn: (report) =>
      [
        report.bookTitle,
        report.title,
        report.wrong,
        report.correct,
        report.content,
        // 表示は最新の1件だけだが、検索は**全件**を対象にする
        // （列に出ていない古い回答で探せなくなるのを避ける＝この searchText の目的そのもの）
        ...report.publisherComments.map((comment) => comment.body),
        report.userName,
      ]
        .filter(Boolean)
        .join(" "),
  },
  {
    accessorKey: "type",
    header: "種別",
    cell: ({ getValue }) => {
      const type = getValue() as ReportType;
      return <Badge label={TYPE_LABELS[type]} className={cn(TYPE_COLORS[type], "whitespace-nowrap")} />;
    },
    filterFn: (row, _, filterValue) =>
      filterValue === "all" || row.original.type === filterValue,
  },
  {
    accessorKey: "bookTitle",
    header: "書籍",
    cell: ({ row }) => (
      <Link
        href={routes.book(row.original.isbn)}
        // 実データの書籍名は長い。nowrap にすると1行で横幅を食い潰すので折り返させる
        className="font-medium text-sm text-blue-700 hover:underline line-clamp-2 max-w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.bookTitle}
      </Link>
    ),
  },
  {
    id: "content",
    header: "内容",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-md">
        <ErrataSummary report={row.original} />
        {/* 投稿タイトルは主役ではないので下に小さく置く（検索語が当たった理由が見える） */}
        <div className="text-xs text-gray-500 line-clamp-1">{row.original.title}</div>
      </div>
    ),
  },
  {
    id: "location",
    header: "位置",
    enableSorting: false,
    cell: ({ row }) => {
      // 版も刷も位置も無いのは電子書籍で位置未記入のときだけ（紙は版とページが必須）
      const label = getEditionLocationLabel(row.original);
      // 折り返しを許す: 電子書籍の位置（"電子書籍 位置No.500（43%付近）"）は長く、
      // nowrap にすると1セルで 220px 使って表全体を横スクロールに追い込む
      return label ? (
        // 数字を等幅にする理由は report-card.tsx の ErrataSummary のコメント参照
        <div className="text-xs text-gray-600 tabular-nums">{label}</div>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "状況",
    cell: ({ row, table }) => {
      const rows = table.getRowModel().rows;
      // 最終行だけツールチップを上向きにする（下向きだと overflow-x-auto のコンテナに切られる）
      const isLastRow = rows[rows.length - 1]?.id === row.id;
      // 出版社の回答は複数付きうるので、表には最新の1件だけ出す（全件は投稿詳細で）
      const latestComment = latestPublisherComment(row.original.publisherComments);
      return (
        <div className="space-y-1">
          <StatusBadge
            status={row.original.status}
            tooltipPlacement={isLastRow ? "top" : "bottom"}
            tooltipAlign="right"
          />
          {latestComment ? (
            <div className="text-xs text-gray-600 line-clamp-2 max-w-48">
              {publisherCommentLabel(latestComment)}: {latestComment.body}
            </div>
          ) : null}
        </div>
      );
    },
    filterFn: (row, _, filterValue) =>
      filterValue === "all" || row.original.status === filterValue,
  },
  {
    accessorKey: "createdAt",
    header: "投稿",
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.upvoteCount > 0 && (
          <div className="text-xs text-gray-600 whitespace-nowrap">👍 {row.original.upvoteCount}</div>
        )}
        <div className="text-xs text-gray-500 whitespace-nowrap">{row.original.createdAt}</div>
        {/* 退会済みユーザーはプロフィールへのリンクも短縮IDも出さない */}
        {row.original.isWithdrawn ? (
          <div className="text-xs text-gray-400 truncate max-w-32">{row.original.userName}</div>
        ) : (
          <Link
            href={routes.user(row.original.userId)}
            className="block text-xs text-gray-600 hover:underline truncate max-w-32"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.userName}
          </Link>
        )}
      </div>
    ),
  },
];

export function ReportTable({ data, initialQuery = "" }: { data: Report[]; initialQuery?: string }) {
  // TanStack Table の useReactTable は React Compiler と非互換（返り値の関数を
  // メモ化すると stale UI になる）ため、このコンポーネントだけ最適化対象から外す。
  "use no memo";

  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // 一覧ページの ?q= を初期検索語として引き継ぐ（トップの検索ボックスからの遷移）。
  const [globalFilter, setGlobalFilter] = useState(initialQuery);

  // 上の "use no memo" で対処済みだが、このルールは opt-out 済みの関数にも警告を出すため行単位で抑制する
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // searchText は検索専用の隠し列（列としては描かない）
    initialState: { pagination: { pageSize: 10 }, columnVisibility: { searchText: false } },
  });

  // TanStack Table の ColumnFilter.value は unknown なので <select> にそのまま渡せず、キャストが要る。
  // ⚠️ キャスト先から undefined を落とさないこと。フィルター未設定なら find() が undefined を返し、
  // 呼び出し側の `?? "all"` がそれを拾っている。`as string` にすると型の上でだけ undefined が消え、
  // 「?? は不要」に見えるが実行時には残る。外すと value={undefined} ＝ 非制御の <select> になり、
  // 選択した瞬間に制御へ切り替わって React が警告を出す。
  const filterValue = (id: string) => columnFilters.find((f) => f.id === id)?.value as string | undefined;

  return (
    <div className="space-y-4">
      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          // 絞り込みバーの部品は見出しを持たず、placeholder と先頭の option が
          // 見た目のラベルを兼ねている。どちらも名前にはならない（placeholder は打つと消え、
          // option は名前ではなく値）ので aria-label で名前を与える。
          aria-label="書籍名・タイトルで検索"
          placeholder="書籍名・タイトルで検索..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SelectField
          aria-label="種別で絞り込む"
          value={filterValue("type") ?? "all"}
          onChange={(e) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== "type"),
              { id: "type", value: e.target.value },
            ])
          }
        >
          <option value="all">種別：すべて</option>
          {(Object.entries(TYPE_LABELS) as [ReportType, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
        <SelectField
          aria-label="ステータスで絞り込む"
          value={filterValue("status") ?? "all"}
          onChange={(e) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== "status"),
              { id: "status", value: e.target.value },
            ])
          }
        >
          <option value="all">ステータス：すべて</option>
          {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
        <span className="text-sm text-gray-500 ml-auto">
          {table.getFilteredRowModel().rows.length} 件
        </span>
      </div>

      {/* 一覧本体。md 未満はカード、md 以上はテーブル（行は同じ getRowModel から描く） */}
      <div className="rounded-lg border border-gray-200 shadow-sm">
        <div className="md:hidden divide-y divide-gray-100">
          {table.getRowModel().rows.map((row) => (
            <ReportCard key={row.id} report={row.original} />
          ))}
        </div>

        {/* md 以上でも列が多く lg 未満では溢れうるので、横スクロールは残す */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-gray-900"
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => router.push(routes.report(row.original.id))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.getRowModel().rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <SearchX className="w-8 h-8 text-gray-300" aria-hidden />
            <p className="text-sm text-gray-400">該当する投稿がありません</p>
            <p className="text-xs text-gray-400">
              検索条件を変えるか、見つけた誤りを最初に報告してみませんか
            </p>
            <Link href={routes.submit} className="mt-1 text-sm text-blue-600 hover:underline">
              投稿する →
            </Link>
          </div>
        )}
      </div>

      {/* ページネーション */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} ページ
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            前へ
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
