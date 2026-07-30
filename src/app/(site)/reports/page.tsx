import type { Metadata } from "next";
import { findAllReports } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { ReportTable } from "@/components/report-table";

export const metadata: Metadata = {
  title: "すべての投稿 | Errata Hub",
  description:
    "読者から投稿された書籍の正誤情報・改善提案の一覧。書籍名・タイトルで検索し、種別・ステータスで絞り込めます。",
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
        <h1 className="text-2xl font-bold text-gray-900">すべての投稿</h1>
        <p className="mt-1 text-sm text-gray-500">
          書籍名・タイトルで検索し、種別・ステータスで絞り込めます。
        </p>
      </div>

      <ReportTable data={reports} initialQuery={q ?? ""} />
    </>
  );
}
