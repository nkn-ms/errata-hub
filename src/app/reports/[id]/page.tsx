import { findReportById } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { STATUS_COLORS_BY_LABEL, STATUS_TOOLTIPS_BY_LABEL } from "@/constants/report-status";
import { notFound } from "next/navigation";
import Link from "next/link";
import { routes } from "@/constants/routes";

type Props = {
  params: Promise<{ id: string }>;
};

const typeColors: Record<string, string> = {
  正誤情報: "bg-purple-100 text-purple-700",
  改善提案: "bg-cyan-100 text-cyan-700",
  その他: "bg-gray-100 text-gray-600",
};

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;

  const raw = await findReportById(id);

  if (!raw) notFound();

  const report = mapReport(raw);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href={routes.home} className="text-lg font-bold text-gray-900">Errata Hub</Link>
          <span className="text-gray-300">/</span>
          <Link href={routes.book(report.bookId)} className="text-sm text-blue-600 hover:underline truncate max-w-xs">
            {report.bookTitle}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 truncate max-w-xs">{report.title}</span>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        {/* 免責バナー */}
        <div className="mb-6 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            この投稿は投稿者からの報告です。<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* タイトルとバッジ */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[report.type]}`}>
                {report.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS_BY_LABEL[report.status] ?? "bg-gray-100 text-gray-700"}`}
                title={STATUS_TOOLTIPS_BY_LABEL[report.status]}
              >
                {report.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              <Link href={routes.user(report.userId)} className="hover:underline">
                {report.userName} <span className="text-gray-400">@{report.userIdShort}</span>
              </Link>
              {" · "}{report.createdAt}
            </p>
          </div>

          {/* 書籍情報 */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-md">
            {report.coverImage && (
              <img src={report.coverImage} alt={report.bookTitle} className="w-16 h-auto object-cover rounded shadow-sm" />
            )}
            <div>
              <Link href={routes.book(report.bookId)} className="font-medium text-blue-700 hover:underline">
                {report.bookTitle}
              </Link>
              {report.bookAuthor && <p className="text-sm text-gray-600 mt-0.5">{report.bookAuthor}</p>}
              {report.publisher && <p className="text-sm text-gray-500">{report.publisher}</p>}
              {report.isbn && <p className="text-xs text-gray-400 mt-1">ISBN: {report.isbn}</p>}
            </div>
          </div>

          {/* 版・刷・位置情報 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {(report.edition || report.printing) && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">版・刷</p>
                <p className="text-gray-800">
                  {report.edition && `第${report.edition}版`}
                  {report.edition && report.printing && " "}
                  {report.printing && `第${report.printing}刷`}
                </p>
              </div>
            )}
            {report.locationType === "ページ" && report.page && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">位置</p>
                <p className="text-gray-800">
                  p.{report.page}
                  {report.line && ` l.${report.line}`}
                  {report.hasMultiplePages && " 他"}
                </p>
              </div>
            )}
            {report.locationType === "Kindle" && report.kindleLocation && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Kindle位置</p>
                <p className="text-gray-800">{report.kindleLocation}</p>
              </div>
            )}
            {report.locationNote && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">補足</p>
                <p className="text-gray-800">{report.locationNote}</p>
              </div>
            )}
          </div>

          {/* 誤り → 正しい表記 */}
          {(report.wrong || report.correct) && (
            <div>
              <p className="text-xs text-gray-500 mb-2">正誤情報</p>
              <div className="flex items-center gap-3">
                {report.wrong && (
                  <div className="flex-1 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                    <p className="text-xs text-red-500 mb-1">誤</p>
                    {report.wrong}
                  </div>
                )}
                {report.wrong && report.correct && (
                  <span className="text-gray-400 text-lg">→</span>
                )}
                {report.correct && (
                  <div className="flex-1 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                    <p className="text-xs text-green-500 mb-1">正</p>
                    {report.correct}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 内容 */}
          {report.content && (
            <div>
              <p className="text-xs text-gray-500 mb-1">詳細内容</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.content}</p>
            </div>
          )}

          {/* 投稿者メモ */}
          {report.note && (
            <div>
              <p className="text-xs text-gray-500 mb-1">投稿者メモ</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.note}</p>
            </div>
          )}

          {/* 画像 */}
          {raw.images.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">証拠画像</p>
              <div className="flex flex-wrap gap-3">
                {raw.images.map((img) => (
                  <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={img.imageUrl}
                      alt="証拠画像"
                      className="w-32 h-auto rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 修正済み情報 */}
          {report.status === "修正済み" && (report.fixedEdition || report.fixedPrinting) && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              ✅ {report.fixedEdition && `第${report.fixedEdition}版`}
              {report.fixedEdition && report.fixedPrinting && " "}
              {report.fixedPrinting && `第${report.fixedPrinting}刷`}
              より修正されました
            </div>
          )}

          {/* 出版社コメント */}
          {report.publisherComment && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-500 mb-1 font-medium">出版社コメント</p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">{report.publisherComment}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Link href={routes.home} className="text-sm text-gray-500 hover:text-gray-700">← 一覧へ戻る</Link>
          <div className="flex items-center gap-3">
            <Link href={routes.book(report.bookId)} className="text-sm text-blue-600 hover:underline">
              この本の投稿一覧
            </Link>
            <Link
              href={routes.submit}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
            >
              この本に投稿する
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
