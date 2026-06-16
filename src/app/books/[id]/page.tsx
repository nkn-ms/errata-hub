import { prisma } from "@/lib/prisma";
import { feedbackInclude } from "@/services/feedback";
import { mapFeedback } from "@/utils/mappers";
import { STATUS_COLORS_BY_LABEL, STATUS_TOOLTIPS_BY_LABEL } from "@/constants/feedback-status";
import { notFound } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params;

  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      publisher: true,
      feedbacks: {
        include: feedbackInclude,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!book) notFound();

  const feedbacks = book.feedbacks.map(mapFeedback);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-gray-900">Errata Hub</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 truncate max-w-xs">{book.title}</span>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        {/* 書籍情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex gap-5">
            {book.coverImageUrl && (
              <img src={book.coverImageUrl} alt={book.title} className="w-24 h-auto object-cover rounded shadow-sm shrink-0" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{book.title}</h1>
              {book.author && <p className="text-sm text-gray-600 mt-1">{book.author}</p>}
              {book.publisher && <p className="text-sm text-gray-500 mt-0.5">{book.publisher.name}</p>}
              {book.isbn && <p className="text-xs text-gray-400 mt-2">ISBN: {book.isbn}</p>}
            </div>
          </div>
        </div>

        {/* フィードバック一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            フィードバック <span className="text-sm font-normal text-gray-500">{feedbacks.length}件</span>
          </h2>
          <Link
            href="/submit"
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
          >
            この本に投稿する
          </Link>
        </div>

        {/* 免責バナー */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されているフィードバックは投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        {feedbacks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
            まだフィードバックはありません
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((feedback) => (
              <Link
                key={feedback.id}
                href={`/feedbacks/${feedback.id}`}
                className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS_BY_LABEL[feedback.status] ?? "bg-gray-100 text-gray-700"}`}
                        title={STATUS_TOOLTIPS_BY_LABEL[feedback.status]}
                      >
                        {feedback.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{feedback.title}</p>
                    {(feedback.wrong || feedback.correct) && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">
                        {feedback.wrong} → {feedback.correct}
                      </p>
                    )}
                    {feedback.content && !feedback.wrong && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{feedback.content}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {feedback.page && (
                      <p className="text-sm text-gray-500">p.{feedback.page}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{feedback.createdAt}</p>
                  </div>
                </div>
                {feedback.status === "修正済み" && (feedback.fixedEdition || feedback.fixedPrinting) && (
                  <p className="mt-2 text-xs text-green-700">
                    ✅ {feedback.fixedEdition && `第${feedback.fixedEdition}版`}
                    {feedback.fixedEdition && feedback.fixedPrinting && " "}
                    {feedback.fixedPrinting && `第${feedback.fixedPrinting}刷`}
                    より修正済み
                  </p>
                )}
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
