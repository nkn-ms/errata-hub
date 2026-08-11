import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdminReportEditor } from "@/components/admin/report-editor";
import { ErratumUrlAdopter } from "@/components/admin/erratum-url-adopter";
import { TYPE_LABELS } from "@/constants/report-labels";
import { formatJstDate } from "@/utils/format";
import type { Report } from "@/generated/prisma/client";

// 位置の1行表示。媒体ごとに入力される項目が違う（紙=ページ/行、電子=位置、その他=メモ）
// ため、媒体で分岐して組み立てる。公開側の一覧（report-table の getLocationLabel）と
// 同趣旨だが、こちらは「その他」で位置メモを出す管理画面向け。
function formatLocation(report: Report): string {
  if (report.medium === "PAPER") {
    let label = `p.${report.page}`;
    if (report.line) label += ` l.${report.line}`;
    if (report.hasMultiplePages) label += " 他";
    return label;
  }
  if (report.medium === "EBOOK") return `電子書籍 ${report.ebookLocation}`;
  return report.locationNote ?? "-";
}

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

  const locationText = formatLocation(report);

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
          <dd>{formatJstDate(report.createdAt)}</dd>

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

      {/* 投稿者が申告した正誤表URL（公開はされていない。管理者が採用の可否を判断する） */}
      {report.reportedErratumUrl && (
        <div className="mb-6">
          <ErratumUrlAdopter
            reportId={report.id}
            reportedUrl={report.reportedErratumUrl}
            currentBookErratumUrl={report.book.erratumUrl}
          />
        </div>
      )}

      {/* ステータス・運営者の補足の編集 */}
      <AdminReportEditor
        id={report.id}
        currentStatus={report.status}
        currentStatusNote={report.statusNote ?? ""}
        currentFixedEdition={report.fixedEdition}
        currentFixedPrinting={report.fixedPrinting}
        images={report.images.map((image) => ({ id: image.id, imageUrl: image.imageUrl }))}
      />
    </div>
  );
}
