import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { reportInclude } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { hostnameOf } from "@/utils/external-url";
import { toCanonicalIsbn } from "@/utils/isbn";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { BookCover } from "@/components/book-cover";

type Props = {
  params: Promise<{ isbn: string }>;
};

// generateMetadata と本体で同じ ISBN を引くため、リクエスト内で1回に重複排除する
const getBook = cache((isbn: string) =>
  prisma.book.findUnique({
    where: { isbn },
    include: {
      publisher: true,
      reports: {
        include: reportInclude,
        orderBy: { createdAt: "desc" },
      },
    },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { isbn } = await params;
  const book = await getBook(toCanonicalIsbn(isbn) ?? isbn);
  if (!book) return { title: "書籍が見つかりません | Errata Hub" };

  return {
    title: `${book.title} の正誤情報・改善提案 | Errata Hub`,
    description: `${book.title} に読者から投稿された正誤情報・改善提案の一覧（${book.reports.length}件）。`,
  };
}

export default async function BookDetailPage({ params }: Props) {
  const { isbn } = await params;

  // 外部から来る ISBN は ISBN-10 やハイフン入りもあり得る。DB は ISBN-13 で保存しているので
  // 正規形へ寄せ、URL が正規形でなければ 308 で正規 URL へ寄せる（1冊=1 URL を保つ）。
  const canonicalIsbn = toCanonicalIsbn(isbn);
  if (!canonicalIsbn) notFound();
  if (canonicalIsbn !== isbn) permanentRedirect(routes.book(canonicalIsbn));

  const book = await getBook(canonicalIsbn);

  if (!book) notFound();

  const reports = book.reports.map(mapReport);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader width="lg" crumbs={[{ label: book.title }]} />

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        {/* 書籍情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex gap-5">
            <BookCover src={book.coverImageUrl} alt={book.title} width={96} height={134} className="w-24 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{book.title}</h1>
              {book.author && <p className="text-sm text-gray-600 mt-1">{book.author}</p>}
              {book.publisher && <p className="text-sm text-gray-500 mt-0.5">{book.publisher.name}</p>}
              {book.isbn && <p className="text-xs text-gray-400 mt-2">ISBN: {book.isbn}</p>}
              {book.erratumUrl && (
                <a
                  href={book.erratumUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-block mt-3 text-sm text-blue-700 hover:underline"
                >
                  出版社の正誤表を見る（{hostnameOf(book.erratumUrl)}）→
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 投稿一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            投稿 <span className="text-sm font-normal text-gray-500">{reports.length}件</span>
          </h2>
          <Link
            href={routes.submitForBook(book.isbn)}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
          >
            この本に投稿する
          </Link>
        </div>

        {/* 免責バナー */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されている投稿は投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
            まだ投稿はありません
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={routes.report(report.id)}
                className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="font-medium text-gray-900 truncate">{report.title}</p>
                    {(report.wrong || report.correct) && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">
                        {report.wrong} → {report.correct}
                      </p>
                    )}
                    {report.content && !report.wrong && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{report.content}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {report.page && (
                      <p className="text-sm text-gray-500">p.{report.page}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{report.createdAt}</p>
                  </div>
                </div>
                {report.status === "FIXED" && (report.fixedEdition || report.fixedPrinting) && (
                  <p className="mt-2 text-xs text-green-700">
                    ✅ {report.fixedEdition && `第${report.fixedEdition}版`}
                    {report.fixedEdition && report.fixedPrinting && " "}
                    {report.fixedPrinting && `第${report.fixedPrinting}刷`}
                    より修正済み
                  </p>
                )}
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
