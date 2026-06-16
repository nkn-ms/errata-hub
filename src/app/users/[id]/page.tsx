import { prisma } from "@/lib/prisma";
import { findFeedbacksByUser } from "@/services/feedback";
import { mapFeedback } from "@/utils/mappers";
import { STATUS_COLORS_BY_LABEL, STATUS_TOOLTIPS_BY_LABEL } from "@/constants/feedback-status";
import { notFound } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

const typeColors: Record<string, string> = {
  誤字脱字: "bg-orange-100 text-orange-700",
  正誤情報: "bg-purple-100 text-purple-700",
  読みにくい: "bg-cyan-100 text-cyan-700",
  その他: "bg-gray-100 text-gray-600",
};

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
    },
  });

  if (!profile) notFound();

  const feedbacks = await findFeedbacksByUser(id);

  const mapped = feedbacks.map(mapFeedback);

  const stats = {
    total: mapped.length,
    fixed: mapped.filter((f) => f.status === "修正済み").length,
    pending: mapped.filter((f) => f.status === "未対応").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-gray-900">Book Feedback Hub</Link>
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

          {/* 仮置き：将来的な機能 */}
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">仮置き — 今後実装予定</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-400">
                GitHub連携
              </span>
              <span className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-400">
                表示名の変更
              </span>
              <span className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-400">
                自己紹介文
              </span>
            </div>
          </div>
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
            {mapped.map((feedback) => (
              <Link
                key={feedback.id}
                href={`/feedbacks/${feedback.id}`}
                className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[feedback.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {feedback.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS_BY_LABEL[feedback.status] ?? "bg-gray-100 text-gray-700"}`}
                        title={STATUS_TOOLTIPS_BY_LABEL[feedback.status]}
                      >
                        {feedback.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{feedback.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {feedback.bookTitle}
                    </p>
                    {(feedback.wrong || feedback.correct) && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">
                        {feedback.wrong} → {feedback.correct}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {feedback.page && (
                      <p className="text-sm text-gray-500">p.{feedback.page}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{feedback.createdAt}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← 一覧へ戻る</Link>
        </div>
      </main>
    </div>
  );
}
