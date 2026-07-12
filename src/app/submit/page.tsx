import { ReportForm } from "@/components/report-form";
import { SiteHeader } from "@/components/site-header";

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">投稿する</h1>
          <p className="mt-1 text-sm text-gray-500">
            書籍の正誤情報・改善提案を投稿してください。
          </p>
        </div>
        <ReportForm />
      </main>
    </div>
  );
}
