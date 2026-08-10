"use client";

import { useState, type FormEvent } from "react";
import { addReportAddendum, type Addendum } from "@/app/actions/report";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { CharCounter, ErrorPanel } from "@/components/report-fields";

// ⚠️ **一覧と入力欄を1つのクライアント部品にまとめてあるのは、書きかけを失わないため。**
// 成功後に refresh() で描き直すと、再描画が**入力欄の DOM ノードごと差し替える**
// （実測: textarea に付けた目印が消える）。そのとき打っていた文字は失われる。
// なので refresh() せず、返ってきた行をこの部品の中で足す。
type Props = {
  reportId: string;
  initialAddenda: Addendum[];
  /** 投稿者本人 かつ 出版社へ連絡した後だけ入力欄を出す（未対応の間は本文を直せるので出さない） */
  canAdd: boolean;
};

export function ReportAddenda({ reportId, initialAddenda, canAdd }: Props) {
  const [addenda, setAddenda] = useState<Addendum[]>(initialAddenda);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (addenda.length === 0 && !canAdd) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setErrors([{ field: "addendum", message: "追記を入力してください" }]);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await addReportAddendum(reportId, { body });
      if (result.error !== undefined) {
        setErrors([{ message: result.error }]);
        return;
      }
      setAddenda((prev) => [...prev, result.addendum]);
      setBody("");
    } catch {
      setErrors([{ message: "追記に失敗しました。もう一度お試しください。" }]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 元の投稿と見た目で対等にはしない（後から足したものが主役になると、
          出版社が見た内容がどれか分からなくなる）。古い順に並べ、各件に日時を出す
          ＝出版社へ連絡した日の前後どちらかが読み手に分かる必要があるため。
          投稿者本人しか書けないので、誰が書いたかは出さない */}
      {addenda.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">追記</p>
          <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {addenda.map((addendum) => (
              <div key={addendum.id} className="px-3 py-2">
                <p className="text-xs text-gray-500 tabular-nums">{addendum.createdAt}</p>
                <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap">{addendum.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {canAdd && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div>
            <label htmlFor="addendum" className="block text-sm font-medium text-gray-700 mb-1">
              追記する
            </label>
            <p className="text-xs text-gray-500 mb-2">
              出版社へ連絡済みのため、元の内容は変更できません。補足があれば追記してください。
            </p>
            <textarea
              id="addendum"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              // 送信中は入力欄も止める。ボタンだけ止めると、送信中に打った文字が
              // 成功時のクリア（setBody("")）で消える
              disabled={submitting}
              maxLength={REPORT_LIMITS.addendum}
              aria-describedby="addendum-count"
              rows={3}
              placeholder="例: ページ番号は p.141 ではなく p.142 の誤りでした"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <CharCounter id="addendum-count" value={body} max={REPORT_LIMITS.addendum} />
          </div>

          <ErrorPanel errors={errors} />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">追記した内容は取り消せません。</p>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {submitting ? "追記中..." : "追記する"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
