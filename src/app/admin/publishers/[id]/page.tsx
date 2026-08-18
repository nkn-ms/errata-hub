import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublisherForm from "@/features/publisher/components/admin/publisher-form";
import { routes } from "@/constants/routes";
import { formatJstDate } from "@/utils/format";

export default async function EditPublisherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const publisher = await prisma.publisher.findUnique({
    where: { id },
    include: {
      // 誰がこの出版社のアクセス権を持っているか。付与が新しい順に並べる
      publisherAccess: {
        include: { profile: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!publisher) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">出版社を編集</h1>
        <p className="mt-1 text-sm text-gray-500">{publisher.name}</p>
      </div>
      <PublisherForm publisher={publisher} />

      {/* アクセス権は「誰が持っているか」だけでなく「なぜ持っているか」まで見せる。
          出版社の画面からは従来 件数しか分からず、誰かを知るにはユーザー一覧を辿る必要があった。
          付与・取り消しの操作はユーザー編集画面が持つので、ここは
          「今どうなっているか」を説明するための面に徹する。 */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900">アクセス権を持つユーザー</h2>
        <p className="mt-1 text-sm text-gray-500">
          付与・取り消しは各ユーザーの編集画面から行います。
        </p>

        <div className="mt-4 overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">ユーザー</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">付与日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">付与者</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {publisher.publisherAccess.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    この出版社のアクセス権を持つユーザーはいません
                  </td>
                </tr>
              )}
              {publisher.publisherAccess.map((access) => (
                <tr key={access.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {access.profile.displayName ?? "(表示名なし)"}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{access.profile.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatJstDate(access.createdAt)}</td>
                  <td className="px-4 py-3">
                    {access.grantedByEmail ? (
                      <span className="text-gray-600 text-xs font-mono">
                        {access.grantedByEmail}
                      </span>
                    ) : (
                      /* null = 付与者の記録が無い行。廃止したドメイン一致の自動付与は監査ログを
                         書いていなかったので、その時代に付いたものがここに該当する。
                         「不明」と流さず理由まで書く（棚卸しの手掛かりになるため）。 */
                      <span className="text-gray-500 text-xs">
                        記録なし（自動付与で付いた可能性）
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={routes.admin.user(access.profile.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      ユーザーを編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
