import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdminReportEditor } from "@/components/admin/report-editor";
import { TYPE_LABELS } from "@/constants/report-labels";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      book: { include: { publisher: true } },
      images: true,
    },
  });

  if (!report) notFound();

  const locationText = report.medium === "PAPER"
    ? `p.${report.page}${report.line ? ` l.${report.line}` : ""}${report.hasMultiplePages ? " 他" : ""}`
    : report.medium === "EBOOK"
    ? `電子書籍 ${report.ebookLocation}`
    : report.locationNote ?? "-";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {report.book.title}
          {report.edition && ` 第${report.edition}版`}
          {report.printing && ` 第${report.printing}刷`}
        </p>
      </div>

      {/* 投稿内容 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700">投稿内容</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-500">種別</dt>
          <dd>{TYPE_LABELS[report.type]}</dd>

          <dt className="text-gray-500">位置</dt>
          <dd>{locationText}</dd>

          {report.locationNote && report.medium === "PAPER" && (
            <>
              <dt className="text-gray-500">位置備考</dt>
              <dd>{report.locationNote}</dd>
            </>
          )}

          {report.wrong && (
            <>
              <dt className="text-gray-500">誤</dt>
              <dd className="whitespace-pre-wrap">{report.wrong}</dd>
            </>
          )}

          {report.correct && (
            <>
              <dt className="text-gray-500">正</dt>
              <dd className="whitespace-pre-wrap">{report.correct}</dd>
            </>
          )}

          {report.content && (
            <>
              <dt className="text-gray-500">内容・提案</dt>
              <dd className="whitespace-pre-wrap">{report.content}</dd>
            </>
          )}

          {report.note && (
            <>
              <dt className="text-gray-500">備考</dt>
              <dd className="whitespace-pre-wrap">{report.note}</dd>
            </>
          )}

          <dt className="text-gray-500">投稿日</dt>
          <dd>{report.createdAt.toISOString().split("T")[0]}</dd>

          {report.images.length > 0 && (
            <>
              <dt className="text-gray-500">添付画像</dt>
              <dd className="flex flex-wrap gap-3">
                {report.images.map((img) => (
                  <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                    {/* 自前 Storage 由来だが書影と同じ unoptimized 恒久運用に合わせる */}
                    <Image
                      src={img.imageUrl}
                      alt="添付画像"
                      width={128}
                      height={180}
                      unoptimized
                      className="w-32 h-auto rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                    />
                  </a>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* 書籍情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3 mb-6">
        <h2 className="text-sm font-semibold text-gray-700">書籍情報</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-gray-500">書籍名</dt>
          <dd>{report.book.title}</dd>
          {report.book.author && (
            <>
              <dt className="text-gray-500">著者</dt>
              <dd>{report.book.author}</dd>
            </>
          )}
          {report.book.publisher && (
            <>
              <dt className="text-gray-500">出版社</dt>
              <dd>{report.book.publisher.name}</dd>
            </>
          )}
          {report.book.isbn && (
            <>
              <dt className="text-gray-500">ISBN</dt>
              <dd>{report.book.isbn}</dd>
            </>
          )}
        </dl>
      </div>

      {/* ステータス・出版社コメント編集 */}
      <AdminReportEditor
        id={report.id}
        currentStatus={report.status}
        currentComment={report.publisherComment ?? ""}
        currentFixedEdition={report.fixedEdition}
        currentFixedPrinting={report.fixedPrinting}
      />
    </div>
  );
}
