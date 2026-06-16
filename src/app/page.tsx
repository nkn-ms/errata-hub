import { FeedbackTable } from "@/components/feedback-table";
import { findRecentFeedbacks } from "@/services/feedback";
import { mapFeedback } from "@/utils/mappers";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

const TOP_PAGE_LIMIT = 10;

export default async function Home() {
  const [rows, supabase] = await Promise.all([findRecentFeedbacks(TOP_PAGE_LIMIT), createClient()]);
  const feedbacks = rows.map(mapFeedback);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">Book Feedback Hub</span>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
                <form action={logout}>
                  <button type="submit" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/register" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  会員登録
                </Link>
                <Link href="/login" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-700 transition-colors">
                  ログイン
                </Link>
              </>
            )}
            <Link
              href="/submit"
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
            >
              投稿する
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">最新のフィードバック</h1>
          <p className="mt-1 text-sm text-gray-500">
            読者から投稿された書籍の誤字脱字・正誤情報・改善提案の一覧です。（最新{TOP_PAGE_LIMIT}件）
          </p>
        </div>

        {/* 免責バナー */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されているフィードバックは投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>

        <FeedbackTable data={feedbacks} />
      </main>
    </div>
  );
}
