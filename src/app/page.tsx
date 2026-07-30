import Link from "next/link";
import { redirect } from "next/navigation";
import { findReportsPage } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { ReportCard } from "@/components/report-card";
import { CompactReportTable } from "@/components/compact-report-table";
import { SiteHeader } from "@/components/site-header";
import { routes } from "@/constants/routes";

// トップの新着フィードは1ページ20件。11件目以降も ?page=N のリンクで辿れる
// （古い投稿が導線から消えず、クローラも辿れる）。
const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { reports: rows, total } = await findReportsPage(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => (n <= 1 ? routes.home : `${routes.home}?page=${n}`);

  // 範囲外の ?page=N（古いリンク・打ち間違い）は最後の有効ページへ寄せる。
  // 投稿はあるのに空スライスを引いて「まだ投稿はありません」を誤表示するのを防ぐ。
  if (total > 0 && page > totalPages) {
    redirect(pageHref(totalPages));
  }

  const reports = rows.map(mapReport);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader width="lg" logoAsLink={false} />

      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">最新の投稿</h1>
          <p className="mt-1 text-sm text-gray-500">
            読者から投稿された書籍の正誤情報・改善提案です。
            {total > 0 && `（全${total}件）`}
          </p>
        </div>

        {/* 検索・絞り込みは一覧ページに委ねる（トップは眺める場所）。form の GET で /reports?q= へ */}
        <form action={routes.reports} className="mb-6 flex gap-2">
          <input
            type="search"
            name="q"
            placeholder="書籍名・タイトルで検索..."
            aria-label="投稿を検索"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            検索
          </button>
        </form>

        {/* 免責バナー */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されている投稿は投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-gray-500">まだ投稿はありません</p>
            <Link href={routes.submit} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              最初の誤りを報告する →
            </Link>
          </div>
        ) : (
          <>
            {/* md 未満（スマホ）はカード、md 以上（PC・タブレット）は削ぎ落としテーブル。
                同じ reports を出し分けるだけで、密度が要るPCは表・幅の無いスマホはカードにする。 */}
            <div className="md:hidden rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
              {reports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
            <div className="hidden md:block">
              <CompactReportTable data={reports} />
            </div>

            {/* ページ送り。<Link> なので人もクローラも辿れる（?page=N を rel でも示す） */}
            <nav className="mt-6 flex items-center justify-between" aria-label="ページ送り">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  rel="prev"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  ← 新しい投稿
                </Link>
              ) : (
                <span aria-disabled="true" className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-300">
                  ← 新しい投稿
                </span>
              )}
              <span className="text-sm text-gray-500">
                {page} / {totalPages} ページ
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  rel="next"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  古い投稿 →
                </Link>
              ) : (
                <span aria-disabled="true" className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-300">
                  古い投稿 →
                </span>
              )}
            </nav>
          </>
        )}

        {/* 謝辞。飾りではなくサイトの立場の表明として置く（誤りを集める場は放っておくと
            批判的な場に見えるため、何の上に成り立っているかを自分で書く）。
            ⚠️ 投稿の作法をここでルールとして繰り返さない。「批判は内容へ」の線引きは
               /how-to-use のルールが持っており、二重に書くと片方だけ古くなる。 */}
        <section aria-labelledby="acknowledgements" className="mt-12 border-t border-gray-200 pt-6">
          <h2 id="acknowledgements" className="text-sm font-semibold text-gray-700">謝辞</h2>
          <div className="mt-2 space-y-2 text-sm text-gray-500 [word-break:auto-phrase]">
            <p>
              このサイトは、著者が積み重ねてきた知見と、それを本にする出版社の仕事があってはじめて成り立っています。その営みに最大限の敬意を表します。
            </p>
            <p>
              同時に、誤りを見つけて共有してくださる投稿者の方々にも同じ敬意を表します。指摘は、本を丁寧に読んだ人からしか生まれません。
            </p>
            <p>
              誤りの指摘は、その本の価値を否定するものではありません。このサイトは、著者と出版社への敬意のうえに指摘が交わされる場でありたいと考えています。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
