import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdminFeedbackEditor } from "@/components/admin/feedback-editor";

export default async function AdminFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      book: { include: { publisher: true } },
      images: true,
    },
  });

  if (!feedback) notFound();

  const TYPE_LABELS = {
    TYPO: "誤字脱字", ERRATA: "正誤情報", READABILITY: "読みにくい", OTHER: "その他",
  };
  const LOCATION_LABELS = {
    PAGE: "ページ", KINDLE: "Kindle", OTHER: "その他",
  };

  const locationText = feedback.locationType === "PAGE"
    ? `p.${feedback.page}${feedback.line ? ` l.${feedback.line}` : ""}${feedback.hasMultiplePages ? " 他" : ""}`
    : feedback.locationType === "KINDLE"
    ? `Kindle ${feedback.kindleLocation}`
    : feedback.locationNote ?? "-";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{feedback.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {feedback.book.title}
          {feedback.edition && ` 第${feedback.edition}版`}
          {feedback.printing && ` 第${feedback.printing}刷`}
        </p>
      </div>

      {/* 投稿内容 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700">投稿内容</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-500">種別</dt>
          <dd>{TYPE_LABELS[feedback.type]}</dd>

          <dt className="text-gray-500">位置</dt>
          <dd>{locationText}</dd>

          {feedback.locationNote && feedback.locationType === "PAGE" && (
            <>
              <dt className="text-gray-500">位置備考</dt>
              <dd>{feedback.locationNote}</dd>
            </>
          )}

          {feedback.wrong && (
            <>
              <dt className="text-gray-500">誤</dt>
              <dd className="whitespace-pre-wrap">{feedback.wrong}</dd>
            </>
          )}

          {feedback.correct && (
            <>
              <dt className="text-gray-500">正</dt>
              <dd className="whitespace-pre-wrap">{feedback.correct}</dd>
            </>
          )}

          {feedback.content && (
            <>
              <dt className="text-gray-500">内容・提案</dt>
              <dd className="whitespace-pre-wrap">{feedback.content}</dd>
            </>
          )}

          {feedback.note && (
            <>
              <dt className="text-gray-500">備考</dt>
              <dd className="whitespace-pre-wrap">{feedback.note}</dd>
            </>
          )}

          <dt className="text-gray-500">投稿日</dt>
          <dd>{feedback.createdAt.toISOString().split("T")[0]}</dd>
        </dl>
      </div>

      {/* 書籍情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3 mb-6">
        <h2 className="text-sm font-semibold text-gray-700">書籍情報</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-500">書籍名</dt>
          <dd>{feedback.book.title}</dd>
          {feedback.book.author && (
            <>
              <dt className="text-gray-500">著者</dt>
              <dd>{feedback.book.author}</dd>
            </>
          )}
          {feedback.book.publisher && (
            <>
              <dt className="text-gray-500">出版社</dt>
              <dd>{feedback.book.publisher.name}</dd>
            </>
          )}
          {feedback.book.isbn && (
            <>
              <dt className="text-gray-500">ISBN</dt>
              <dd>{feedback.book.isbn}</dd>
            </>
          )}
        </dl>
      </div>

      {/* ステータス・出版社コメント編集 */}
      <AdminFeedbackEditor
        id={feedback.id}
        currentStatus={feedback.status}
        currentComment={feedback.publisherComment ?? ""}
        currentFixedEdition={feedback.fixedEdition}
        currentFixedPrinting={feedback.fixedPrinting}
      />
    </div>
  );
}
