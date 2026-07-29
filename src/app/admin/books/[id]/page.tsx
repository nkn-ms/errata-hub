import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdminBookEditor } from "@/components/admin/book-editor";
import { routes } from "@/constants/routes";
import { hostnameOf } from "@/utils/external-url";

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      publisher: { select: { name: true } },
      _count: { select: { reports: true } },
    },
  });

  if (!book) notFound();

  // 正誤表URLの入口は2つある（ここ＝管理者が直接入れる／投稿詳細＝読者の申告を検証して採用する）。
  // 書き込み先は Book.erratumUrl の1つだが、この画面からは申告の存在が見えず「投稿したのに反映されない」
  // という誤解の元になっていたので、未採用の申告をここに出して投稿詳細へ辿れるようにする。
  const reportsWithErratumUrl = await prisma.report.findMany({
    where: { bookId: id, reportedErratumUrl: { not: null } },
    select: { id: true, reportedErratumUrl: true },
    orderBy: { createdAt: "desc" },
  });
  // 同じURLが複数の投稿から申告されることがあるので、URL 単位にまとめる（採用は1回で済むため）。
  // 既に公式リンクになっているURLは「未採用」ではないので除く。
  const unadoptedErratumUrls = new Map<string, string>(); // URL → 最新の申告元の投稿ID
  for (const { id: reportId, reportedErratumUrl: url } of reportsWithErratumUrl) {
    if (!url || url === book.erratumUrl || unadoptedErratumUrls.has(url)) continue;
    unadoptedErratumUrls.set(url, reportId);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">書籍を編集</h1>
        <p className="mt-1 text-sm text-gray-500">{book.title}</p>
      </div>

      {unadoptedErratumUrls.size > 0 && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            未採用の正誤表URLの申告（{unadoptedErratumUrls.size}件）
          </h2>
          <p className="text-xs text-gray-500">
            この本の投稿者が申告したURLです。公開ページには出ていません。内容を確認して採用する操作は
            投稿詳細から行います。
          </p>
          <ul className="space-y-3">
            {[...unadoptedErratumUrls].map(([url, reportId]) => (
              <li key={url} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-blue-700 hover:underline break-all"
                >
                  {url}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                  <span className="text-gray-400">リンク先ホスト: {hostnameOf(url)}</span>
                  <Link href={routes.admin.report(reportId)} className="text-blue-600 hover:underline">
                    投稿を開いて採用する →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminBookEditor
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisherName: book.publisher?.name ?? null,
          coverImageUrl: book.coverImageUrl,
          erratumUrl: book.erratumUrl,
          reportCount: book._count.reports,
        }}
      />
    </div>
  );
}
