import { ReportTable } from "@/components/report-table";
import { findRecentReports } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { createClient } from "@/lib/supabase/server";
import { HeaderNav } from "@/components/header-nav";

const TOP_PAGE_LIMIT = 10;

export default async function Home() {
  const [rows, supabase] = await Promise.all([findRecentReports(TOP_PAGE_LIMIT), createClient()]);
  const reports = rows.map(mapReport);
  const { data: { user } } = await supabase.auth.getUser();
  // ヘッダーにはメールではなく表示名を出す。表示名が無いときのみメールにフォールバック。
  const userName = user
    ? ((user.user_metadata?.display_name as string) || user.email || null)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">Errata Hub</span>
          <HeaderNav userName={userName} />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">最新の投稿</h1>
          <p className="mt-1 text-sm text-gray-500">
            読者から投稿された書籍の正誤情報・改善提案の一覧です。（最新{TOP_PAGE_LIMIT}件）
          </p>
        </div>

        {/* 免責バナー */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されている投稿は投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        <ReportTable data={reports} />
      </main>
    </div>
  );
}
