import { notFound, redirect } from "next/navigation";
import { findReportById } from "@/services/report";
import { createClient } from "@/lib/supabase/server";
import { ReportEditForm } from "@/components/report-edit-form";
import { toReportFieldsValue } from "@/utils/report-fields-value";
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
          出版社へ連絡するまでは、投稿の内容を修正できます。
        </p>
      </div>
      <ReportEditForm
        reportId={report.id}
        book={{
          title: report.book.title,
          author: report.book.author ?? "",
          publisher: report.book.publisher?.name ?? "",
          isbn: report.book.isbn,
          coverImageUrl: report.book.coverImageUrl ?? "",
        }}
        initialFields={toReportFieldsValue(report)}
        initialImages={report.images.map((image) => ({ id: image.id, imageUrl: image.imageUrl }))}
      />
    </div>
  );
}
