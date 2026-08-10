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

// 投稿者が自分の投稿を直す画面。
//
// ⚠️ ここでの本人確認は**画面を出すかどうかだけ**の判断で、保存の可否は
//    updateOwnReport がトランザクションの中で改めて確かめる（この画面を開いたまま
//    時間が経つ・URL を直接叩く経路があるため、画面側の判定は防御にならない）。
export default async function ReportEditPage({ params }: Props) {
  const { id } = await params;

  const report = await findReportById(id);
  if (!report) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 他人の投稿・未ログインは投稿の詳細へ返す。404 にはしない（投稿自体は公開されており、
  // 「存在しない」と嘘をつくことになるため）
  if (!user || user.id !== report.userId) redirect(routes.report(id));
  // 出版社へ連絡した後は本文を直せない。詳細ページに戻せば、そこに追記の欄が出ている
  // （⚠️ ここは画面を出すかどうかだけの判断。保存の可否は updateOwnReport が
  //   トランザクションの中で改めて確かめる＝開いたまま管理者が連絡済みにする競合があるため）
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
      />
    </div>
  );
}
