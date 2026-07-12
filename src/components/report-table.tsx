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
import { Report, ReportType, ReportStatus } from "@/types/report";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TOOLTIPS } from "@/constants/report-status";
import { TYPE_LABELS, TYPE_COLORS } from "@/constants/report-labels";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {label}
    </span>
  );
}

function getLocationLabel(report: Report): string {
  if (report.medium === "EBOOK") return `電子書籍 ${report.ebookLocation ?? ""}`;
  if (report.medium === "PAPER") {
    let label = `p.${report.page}`;
    if (report.line) label += ` l.${report.line}`;
    if (report.hasMultiplePages) label += " 他";
    return label;
  }
  return "";
}

function getErrataLabel(report: Report): string {
  if (report.wrong && report.correct) {
    return `${report.wrong} → ${report.correct}`;
  }
  return report.content ?? "";
}

const columns: ColumnDef<Report>[] = [
  {
    accessorKey: "bookTitle",
    header: "書籍名",
    cell: ({ row }) => (
      <Link
        href={routes.book(row.original.bookId)}
        className="font-medium text-sm text-blue-700 hover:underline whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.bookTitle}
      </Link>
    ),
  },
  {
    id: "edition",
    header: "版・刷",
    cell: ({ row }) => {
      const { edition, printing } = row.original;
      if (!edition && !printing) return <span className="text-xs text-gray-400">-</span>;
      return (
        <div className="text-xs text-gray-600">
          {edition && <div>第{edition}版</div>}
          {printing && <div>第{printing}刷</div>}
        </div>
      );
    },
  },
  {
    id: "location",
    header: "位置",
    cell: ({ row }) => (
      <div className="text-sm text-gray-600 whitespace-nowrap">{getLocationLabel(row.original)}</div>
    ),
  },
  {
    accessorKey: "title",
    header: "タイトル",
    cell: ({ getValue }) => (
      <div className="text-sm text-gray-800 max-w-48 truncate">{getValue() as string}</div>
    ),
  },
  {
    id: "errata",
    header: "正誤・内容",
    cell: ({ row }) => (
      <div className="text-sm text-gray-700 max-w-56 truncate">
        {getErrataLabel(row.original)}
      </div>
    ),
  },
  {
    accessorKey: "publisherComment",
    header: "出版社コメント",
    cell: ({ getValue }) => {
      const comment = getValue() as string;
      return comment ? (
        <div className="text-sm text-gray-700 max-w-56 truncate">{comment}</div>
      ) : (
        <span className="text-xs text-gray-400">未回答</span>
      );
    },
  },
  {
    accessorKey: "type",
    header: "種別",
    cell: ({ getValue }) => {
      const type = getValue() as ReportType;
      return <Badge label={TYPE_LABELS[type]} className={TYPE_COLORS[type]} />;
    },
    filterFn: (row, _, filterValue) =>
      filterValue === "all" || row.original.type === filterValue,
  },
  {
    accessorKey: "status",
    header: "ステータス",
    cell: ({ getValue }) => {
      const status = getValue() as ReportStatus;
      return (
        <span title={STATUS_TOOLTIPS[status]}>
          <Badge label={STATUS_LABELS[status]} className={STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"} />
        </span>
      );
    },
    filterFn: (row, _, filterValue) =>
      filterValue === "all" || row.original.status === filterValue,
  },
  {
    accessorKey: "upvoteCount",
    header: "賛同",
    cell: ({ getValue }) => {
      const count = getValue() as number;
      return count > 0 ? (
        <div className="text-sm text-gray-700 whitespace-nowrap">👍 {count}</div>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      );
    },
  },
  {
    accessorKey: "userName",
    header: "投稿者",
    cell: ({ row }) =>
      // 退会済みユーザーはプロフィールへのリンクも短縮IDも出さない。
      row.original.isWithdrawn ? (
        <div className="text-sm text-gray-400">{row.original.userName}</div>
      ) : (
        <Link
          href={routes.user(row.original.userId)}
          className="block hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm text-gray-600">{row.original.userName}</div>
          <div className="text-xs text-gray-400">@{row.original.userIdShort}</div>
        </Link>
      ),
  },
  {
    accessorKey: "createdAt",
    header: "投稿日",
    cell: ({ getValue }) => (
      <div className="text-sm text-gray-500 whitespace-nowrap">{getValue() as string}</div>
    ),
  },
];

export function ReportTable({ data }: { data: Report[] }) {
  // TanStack Table の useReactTable は React Compiler と非互換（返り値の関数を
  // メモ化すると stale UI になる）ため、このコンポーネントだけ最適化対象から外す。
  "use no memo";

  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

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
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="書籍名・タイトルで検索..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={(columnFilters.find((f) => f.id === "type")?.value as string) ?? "all"}
          onChange={(e) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== "type"),
              { id: "type", value: e.target.value },
            ])
          }
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">種別：すべて</option>
          {(Object.entries(TYPE_LABELS) as [ReportType, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={(columnFilters.find((f) => f.id === "status")?.value as string) ?? "all"}
          onChange={(e) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== "status"),
              { id: "status", value: e.target.value },
            ])
          }
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">ステータス：すべて</option>
          {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {table.getFilteredRowModel().rows.length} 件
        </span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
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
