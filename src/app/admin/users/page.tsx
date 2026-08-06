import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_PAGE_SIZE, AdminPagination } from "@/components/admin/pagination";
import { routes } from "@/constants/routes";
import { formatJstDate } from "@/utils/format";
import { paginate } from "@/utils/pagination";
import { toPageNumber } from "@/utils/parse";

const ROLE_LABELS = {
  ADMIN: "管理者",
  USER: "一般",
} as const;

const ROLE_COLORS = {
  ADMIN: "bg-red-100 text-red-800",
  USER: "bg-gray-100 text-gray-600",
} as const;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

const pageHref = (n: number) => `${routes.admin.users}?page=${n}`;

export default async function AdminUsersPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = toPageNumber(pageParam);

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      include: {
        publisherAccess: { include: { publisher: true } },
      },
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.profile.count(),
  ]);

  const { totalPages, isOutOfRange, from, to } = paginate(page, total, ADMIN_PAGE_SIZE);
  if (isOutOfRange) redirect(pageHref(totalPages));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
        <p className="mt-1 text-sm text-gray-500">全 {total} 件</p>
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
                  {formatJstDate(p.createdAt)}
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

      <AdminPagination page={page} totalPages={totalPages} from={from} to={to} total={total} href={pageHref} />
    </div>
  );
}
