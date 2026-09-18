import { notFound, redirect } from "next/navigation";
import { findReportById } from "@/features/report/db/queries";
import { createClient } from "@/lib/supabase/server";
import { ReportEditForm } from "@/features/report/components/report-edit-form";
import { ReportWithdraw } from "@/features/report/components/report-withdraw";
import { toReportFieldsValue } from "@/features/report/utils/report-fields-value";
import { routes } from "@/constants/routes";
import { FORM_COLUMN } from "@/constants/layout";

type Props = {
  params: Promise<{ id: string }>;
};

// ⚠️ この画面の判定は「出すかどうか」だけ。保存の可否は updateOwnReport が
//    トランザクションの中で改めて確かめる（開いたまま時間が経つ・URL 直叩きがあるため）。
export default async function ReportEditPage({ params }: Props) {
  const { id } = await params;

  const report = await findReportById(id);
  if (!report) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 404 にしないのは、投稿自体は公開されていて「存在しない」が嘘になるため
  if (!user || user.id !== report.userId) redirect(routes.report(id));
  // 連絡後は本文を直せない。戻した先の詳細ページに追記の欄が出ている
  if (report.status !== "PENDING") redirect(routes.report(id));

  return (
    <div className={FORM_COLUMN}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">投稿を編集する</h1>
        <p className="mt-1 text-sm text-gray-500">
          出版社や著者へ連絡するまでは、投稿の内容を修正できます。
        </p>
      </div>
      <ReportEditForm
        reportId={report.id}
        book={{
          title: report.bookTitle,
          author: report.bookAuthor,
          publisher: report.publisher,
          isbn: report.isbn,
          coverImageUrl: report.coverImage,
        }}
        initialFields={toReportFieldsValue(report)}
        // 追記に添えた画像は Report.images に入らない（queries.ts が本体の画像だけに絞る）
        initialImages={report.images}
      />
      {/* 取り下げられる条件は編集と同じ（PENDING かつ本人）なので、この画面の下に置く */}
      <ReportWithdraw reportId={report.id} title={report.title} />
    </div>
  );
}
