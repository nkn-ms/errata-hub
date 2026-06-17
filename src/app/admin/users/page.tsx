import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { routes } from "@/constants/routes";

const ROLE_LABELS = {
  ADMIN: "管理者",
  USER: "一般",
} as const;

const ROLE_COLORS = {
  ADMIN: "bg-red-100 text-red-800",
  USER: "bg-gray-100 text-gray-600",
} as const;

export default async function AdminUsersPage() {
  const profiles = await prisma.profile.findMany({
    include: {
      publisherAccess: { include: { publisher: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
        <p className="mt-1 text-sm text-gray-500">全 {profiles.length} 件</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">メールアドレス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">ロール</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">出版社アクセス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">登録日</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  ユーザーがいません
                </td>
              </tr>
            )}
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{p.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role]}`}>
                    {ROLE_LABELS[p.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {p.publisherAccess.length === 0
                    ? "-"
                    : p.publisherAccess.map((a) => a.publisher.name).join(", ")}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {p.createdAt.toISOString().split("T")[0]}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={routes.admin.user(p.id)}
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
