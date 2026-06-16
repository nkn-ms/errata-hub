import { FeedbackForm } from "@/components/feedback-form";
import Link from "next/link";
import { routes } from "@/constants/routes";

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href={routes.home} className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors">
            Errata Hub
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">フィードバックを投稿</h1>
          <p className="mt-1 text-sm text-gray-500">
            書籍の誤字脱字・正誤情報・改善提案を投稿してください。
          </p>
        </div>
        <FeedbackForm />
      </main>
    </div>
  );
}
