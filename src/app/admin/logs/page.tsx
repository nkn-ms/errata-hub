import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_PAGE_SIZE, AdminPagination } from "@/components/admin/pagination";
import { routes } from "@/constants/routes";
import { shortId } from "@/utils/format";
import { paginate } from "@/utils/pagination";
import { toPageNumber } from "@/utils/parse";
import { AUDIT_ACTION_LABELS, auditActionLabel } from "@/constants/audit";
import type { Prisma } from "@/generated/prisma/client";

/**
 * 変更前 / 変更後の中身。**既定は1行に切り、開くと全文を読める**。
 *
 * ⚠️ 切り詰めを外して出しっぱなしにはできない。「投稿削除」「投稿者による取り下げ」の変更前には
 * **投稿1件が丸ごと（画像の配列を含めて）**入るので、常に全文だと1行が画面数個分になり一覧が成立しない。
 *
 * ⚠️ これは「読めない」の症状に効くだけで、原因の片方は残る＝**記録に入っていない値は開いても出てこない**
 * （例: 出版社アクセスの付与・剥奪は対象ユーザーが `targetId` の UUID しかなく、メールを持っていない）。
 *
 * クライアント部品にしないのは `<details>` だけで開閉が成立するため（JS 無しで動き、キーボード操作も付いてくる）。
 */
function JsonCell({ value }: { value: Prisma.JsonValue | null }) {
  if (!value) return <span className="text-gray-400">-</span>;

  return (
    <details>
      {/* 三角の目印は残す（クリックできることの唯一の手掛かり）。省略は中の span で行う */}
      <summary className="cursor-pointer hover:text-gray-700">
        <span className="inline-block max-w-[160px] truncate align-bottom">
          {JSON.stringify(value)}
        </span>
      </summary>
      <pre className="mt-2 max-w-md whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-gray-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

type Props = {
  searchParams: Promise<{
    page?: string;
    action?: string;
    email?: string;
  }>;
};

export default async function AdminLogsPage({ searchParams }: Props) {
  const { page: pageParam, action, email } = await searchParams;
  const page = toPageNumber(pageParam);

  const where = {
    ...(action ? { action } : {}),
    ...(email ? { userEmail: { contains: email, mode: "insensitive" as const } } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）。
      // 監査ログは1トランザクションで複数行が同時刻に入りうるので、ここは特に効く
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const { totalPages, isOutOfRange, from, to } = paginate(page, total, ADMIN_PAGE_SIZE);

  // 絞り込み条件（action・email）はページ番号と一緒に持ち回る。落とすと「次へ」で条件が消える
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    params.set("page", String(n));
    if (action) params.set("action", action);
    if (email) params.set("email", email);
    return `${routes.admin.logs}?${params.toString()}`;
  };

  if (isOutOfRange) redirect(pageHref(totalPages));

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
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
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
                    {auditActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {log.targetType}:{shortId(log.targetId)}…
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono align-top">
                  <JsonCell value={log.before} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono align-top">
                  <JsonCell value={log.after} />
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
