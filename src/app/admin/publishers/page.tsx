import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { routes } from "@/constants/routes";

export default async function AdminPublishersPage() {
  const publishers = await prisma.publisher.findMany({
    include: { _count: { select: { books: true, publisherAccess: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">出版社マスタ</h1>
          <p className="mt-1 text-sm text-gray-500">全 {publishers.length} 件</p>
        </div>
        <Link
          href={routes.admin.publisherNew}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          + 新規追加
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">出版社名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">メール</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">ドメイン</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">書籍数</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">担当ユーザー</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {publishers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  出版社が登録されていません
                </td>
              </tr>
            )}
            {publishers.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.email ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.emailDomain ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{p._count.books}</td>
                <td className="px-4 py-3 text-gray-600">{p._count.publisherAccess}</td>
                <td className="px-4 py-3">
                  <Link
                    href={routes.admin.publisher(p.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    編集
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
