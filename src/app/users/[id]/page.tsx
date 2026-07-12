import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { findReportsByUser } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TOOLTIPS } from "@/constants/report-status";
import { TYPE_LABELS, TYPE_COLORS } from "@/constants/report-labels";
import { notFound } from "next/navigation";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { isWithdrawnEmail, WITHDRAWN_DISPLAY_NAME } from "@/lib/withdrawal";
import { GitHubIcon, XIcon } from "@/components/icons";

type Props = {
  params: Promise<{ id: string }>;
};

// generateMetadata と本体で同じ ID を引くため、リクエスト内で1回に重複排除する
const getProfile = cache((id: string) =>
  prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      email: true,
      githubUsername: true,
      xUsername: true,
      createdAt: true,
    },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "ユーザーが見つかりません | Errata Hub" };

  const name = isWithdrawnEmail(profile.email)
    ? WITHDRAWN_DISPLAY_NAME
    : (profile.displayName ?? "匿名");
  return {
    title: `${name} (@${profile.id.slice(0, 8)}) | Errata Hub`,
    description: `${name} さんの投稿一覧。`,
  };
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;

  const profile = await getProfile(id);

  if (!profile) notFound();

  // 退会済みユーザーのページは「退会済みです」とだけ表示し、投稿一覧は出さない（案1）。
  // 公開上の追跡可能性を弱めるため。email は判定にのみ使い表示はしない。
  if (isWithdrawnEmail(profile.email)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            <Link href={routes.home} className="text-lg font-bold text-gray-900">Errata Hub</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">ユーザー</span>
          </div>
        </header>
        <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-16">
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center">
            <p className="text-2xl mb-3">👤</p>
            <p className="text-base font-medium text-gray-700">{WITHDRAWN_DISPLAY_NAME}です</p>
            <p className="mt-2 text-sm text-gray-400">このユーザーは退会しています。</p>
          </div>
          <div className="mt-6">
            <Link href={routes.home} className="text-sm text-gray-500 hover:text-gray-700">← 一覧へ戻る</Link>
          </div>
        </main>
      </div>
    );
  }

  const reports = await findReportsByUser(id);

  const mapped = reports.map(mapReport);

  const stats = {
    total: mapped.length,
    fixed: mapped.filter((f) => f.status === "FIXED").length,
    pending: mapped.filter((f) => f.status === "PENDING").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href={routes.home} className="text-lg font-bold text-gray-900">Errata Hub</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">ユーザー</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">{profile.displayName ?? "匿名"}</span>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        {/* プロフィール情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            {/* アバター（仮置き） */}
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-400 shrink-0">
              {(profile.displayName ?? "?")[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {profile.displayName ?? "匿名"}
              </h1>
              <p className="text-sm text-gray-400">@{profile.id.slice(0, 8)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {profile.createdAt.toISOString().split("T")[0]} から参加
              </p>
            </div>
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">投稿数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.fixed}</p>
              <p className="text-xs text-gray-500">修正済み</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{stats.pending}</p>
              <p className="text-xs text-gray-500">未対応</p>
            </div>
          </div>

          {/* 公開リンク（本人がアカウント設定で入力した場合のみ表示）。
              自己申告のため rel=nofollow（リンクスパム対策）＋ ugc を付ける。 */}
          {(profile.githubUsername || profile.xUsername) && (
            <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-100">
              {profile.githubUsername && (
                <a
                  href={`https://github.com/${profile.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <GitHubIcon className="w-3.5 h-3.5" />
                  {profile.githubUsername}
                </a>
              )}
              {profile.xUsername && (
                <a
                  href={`https://x.com/${profile.xUsername}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <XIcon className="w-3.5 h-3.5" />
                  @{profile.xUsername}
                </a>
              )}
            </div>
          )}
        </div>

        {/* 投稿一覧 */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            投稿一覧 <span className="text-sm font-normal text-gray-500">{mapped.length}件</span>
          </h2>
        </div>

        {mapped.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
            まだ投稿はありません
          </div>
        ) : (
          <div className="space-y-3">
            {mapped.map((report) => (
              <Link
                key={report.id}
                href={routes.report(report.id)}
                className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[report.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABELS[report.type]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status] ?? "bg-gray-100 text-gray-700"}`}
                        title={STATUS_TOOLTIPS[report.status]}
                      >
                        {STATUS_LABELS[report.status]}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{report.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {report.bookTitle}
                    </p>
                    {(report.wrong || report.correct) && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">
                        {report.wrong} → {report.correct}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {report.page && (
                      <p className="text-sm text-gray-500">p.{report.page}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{report.createdAt}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href={routes.home} className="text-sm text-gray-500 hover:text-gray-700">← 一覧へ戻る</Link>
        </div>
      </main>
    </div>
  );
}
