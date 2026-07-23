import type { Metadata } from "next";
import { findAllReports } from "@/services/report";
import { getHeaderUser } from "@/lib/header-user";
import { mapReport } from "@/utils/mappers";
import { ReportTable } from "@/components/report-table";
import { HeaderNav } from "@/components/header-nav";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "すべての投稿 | Errata Hub",
  description:
    "読者から投稿された書籍の正誤情報・改善提案の一覧。書籍名・タイトルで検索し、種別・ステータスで絞り込めます。",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const [{ q }, rows, headerUser] = await Promise.all([
    searchParams,
    findAllReports(),
    getHeaderUser(),
  ]);
  const reports = rows.map(mapReport);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader>
        <HeaderNav userName={headerUser.userName} isAdmin={headerUser.isAdmin} />
      </SiteHeader>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">すべての投稿</h1>
          <p className="mt-1 text-sm text-gray-500">
            書籍名・タイトルで検索し、種別・ステータスで絞り込めます。
          </p>
        </div>

        <ReportTable data={reports} initialQuery={q ?? ""} />
      </main>
    </div>
  );
}
