"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateOwnReport } from "@/app/actions/report";
import { routes } from "@/constants/routes";
import {
  ErrorPanel,
  MediumFields,
  ReportContentFields,
  reportFieldsErrors,
  toReportBody,
  type ReportFieldsValue,
} from "@/components/report-fields";

type BookSummary = {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

type Props = {
  reportId: string;
  book: BookSummary;
  initialFields: ReportFieldsValue;
};

// 入力欄は新規投稿と共有している = report-fields.tsx
//
// 新規投稿にあって、ここに**意図的に無いもの**（コードからは読み取れないので残す）:
//   - 書籍の選び直し … 本が変わるなら別の投稿
//   - 確認画面 … 直しに来た人は自分が何を書いたか既に知っている
//   - 画像 … 追加は本人に開いているが削除が管理者専用で、片方だけ出すと中途半端になる
export function ReportEditForm({ reportId, book, initialFields }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<ReportFieldsValue>(initialFields);
  const patchFields = (patch: Partial<ReportFieldsValue>) =>
    setFields((prev) => ({ ...prev, ...patch }));
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = reportFieldsErrors(fields);
    if (found.length > 0) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const result = await updateOwnReport(reportId, toReportBody(fields));
      if (result.error !== undefined) {
        setErrors([{ message: result.error }]);
        return;
      }
      router.push(routes.report(reportId));
    } catch {
      setErrors([{ message: "更新に失敗しました。もう一度お試しください。" }]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">書籍情報</h2>

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1">書籍名</span>
          {/* 「別の本を選ぶ」は置かない（本を変えるのは別の投稿を作ること） */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            {book.coverImageUrl ? (
              <Image src={book.coverImageUrl} alt="" width={48} height={64} unoptimized className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" />
            ) : (
              <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{book.title}</div>
              <div className="text-xs text-gray-600 mt-0.5">{book.author}</div>
              <div className="text-xs text-gray-500">{book.publisher}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                ISBN: <span className="font-mono">{book.isbn}</span>
              </div>
            </div>
          </div>
        </div>

        <MediumFields value={fields} onChange={patchFields} />
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">投稿内容</h2>
        <ReportContentFields value={fields} onChange={patchFields} />
      </section>

      <ErrorPanel errors={errors} />

      <div className="flex gap-3 justify-end">
        <Link
          href={routes.report(reportId)}
          className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "更新中..." : "更新する"}
        </button>
      </div>
    </form>
  );
}
