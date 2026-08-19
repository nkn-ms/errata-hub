import type { Metadata } from "next";
import { findAllReports } from "@/features/report/service";
import { mapReport } from "@/features/report/utils/mappers";
import { ReportTable } from "@/features/report/components/report-table";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "投稿一覧 | Errata Hub",
  description:
    "読者から投稿された書籍の正誤情報・改善提案の一覧。書籍名・投稿の内容で検索し、種別・ステータスで絞り込めます。",
  // 検索語（?q=）が付いても正規の URL は /reports 1本だと宣言する。
  // ?q= は同じ一覧の絞り込みでしかなく、検索語は無限に作れるので、放っておくと
  // 「中身がほぼ同じ URL」が無数にインデックス候補になる。
  //
  // ⚠️ トップの ?page=N は逆で、ページごとに載っている投稿が違う＝別のページなので集約しない
  //    （app/(site)/page.tsx の generateMetadata を参照）。
  // 相対パスは metadataBase（app/layout.tsx）を基準に絶対 URL へ解決される。
  alternates: { canonical: routes.reports },
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const [{ q }, rows] = await Promise.all([searchParams, findAllReports()]);
  const reports = rows.map(mapReport);

  return (
    <>
      <div className="mb-6">
        {/* ⚠️「すべての投稿」にしない。検索や絞り込みを当てた状態でも表示される見出しなので、
            網羅を主張すると実際に出ている行と食い違う。「一覧」は網羅を主張しないので絞り込んでも真。 */}
        <h1 className="text-2xl font-bold text-gray-900">投稿一覧</h1>
        <p className="mt-1 text-sm text-gray-500">
          書籍名・投稿の内容で検索し、種別・ステータスで絞り込めます。
        </p>
      </div>

      <ReportTable data={reports} initialQuery={q ?? ""} />
    </>
  );
}
