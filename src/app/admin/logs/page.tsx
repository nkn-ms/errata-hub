import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { shortId } from "@/utils/format";

const ACTION_LABELS: Record<string, string> = {
  UPDATE_REPORT: "投稿更新",
  DELETE_REPORT: "投稿削除",
  DELETE_REPORT_IMAGE: "添付画像削除",
  ADOPT_ERRATUM_URL: "正誤表URL採用",
  UPDATE_USER_ROLE: "ロール変更",
  GRANT_PUBLISHER_ACCESS: "出版社アクセス付与",
  REVOKE_PUBLISHER_ACCESS: "出版社アクセス削除",
  UPDATE_BOOK: "書籍更新",
  DELETE_BOOK: "書籍削除",
  WITHDRAW_USER: "退会",
  ADMIN_WITHDRAW_USER: "退会（管理者代行）",
};

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{
    page?: string;
    action?: string;
    email?: string;
  }>;
};

export default async function AdminLogsPage({ searchParams }: Props) {
  const { page, action, email } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1"));

  const where = {
    ...(action ? { action } : {}),
    ...(email ? { userEmail: { contains: email, mode: "insensitive" as const } } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (action) params.set("action", action);
    if (email) params.set("email", email);
    return `/admin/logs?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">操作ログ</h1>
        <p className="mt-1 text-sm text-gray-500">全 {total} 件</p>
      </div>

      {/* フィルター */}
      <form method="GET" className="mb-4 flex gap-3 flex-wrap">
        <select
          name="action"
          defaultValue={action ?? ""}
          className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">操作：すべて</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          name="email"
          defaultValue={email ?? ""}
          placeholder="メールアドレスで絞り込み"
          className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 w-64"
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          絞り込み
        </button>
        {(action || email) && (
          <Link
            href={routes.admin.logs}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            リセット
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">日時</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">操作者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">操作</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">対象</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">変更前</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">変更後</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  ログがありません
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {log.createdAt.toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {log.userEmail ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {log.targetType}:{shortId(log.targetId)}…
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[160px] truncate">
                  {log.before ? JSON.stringify(log.before) : "-"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[160px] truncate">
                  {log.after ? JSON.stringify(log.after) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-500">
            {(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, total)} 件目 / 全 {total} 件
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildUrl(currentPage - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                前へ
              </Link>
            )}
            <span className="px-3 py-1.5 text-gray-600">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={buildUrl(currentPage + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                次へ
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
