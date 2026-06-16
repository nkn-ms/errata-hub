import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/report-status";
import { routes } from "@/constants/routes";

const TYPE_LABELS = {
  TYPO: "誤字脱字",
  ERRATA: "正誤情報",
  READABILITY: "読みにくい",
  OTHER: "その他",
} as const;

export default async function AdminReportsPage() {
  const reports = await prisma.report.findMany({
    include: {
      book: { include: { publisher: true } },
      user: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">投稿一覧</h1>
        <p className="mt-1 text-sm text-gray-500">全 {reports.length} 件</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">書籍名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">タイトル</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">種別</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">出版社</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">ステータス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">投稿日</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  投稿がありません
                </td>
              </tr>
            )}
            {reports.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 line-clamp-1 max-w-[180px]">{f.book.title}</div>
                  {f.book.publisher && (
                    <div className="text-xs text-gray-400">{f.book.publisher.name}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="line-clamp-1 max-w-[200px] text-gray-700">{f.title}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {TYPE_LABELS[f.type]}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {f.book.publisher?.name ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status]}`}>
                    {STATUS_LABELS[f.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {f.createdAt.toISOString().split("T")[0]}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={routes.admin.report(f.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    詳細・編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
