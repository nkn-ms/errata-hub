"use client";

import { useRef, useState } from "react";
import { withdrawOwnReport } from "@/features/report/actions/report";
import { ErrorPanel } from "@/features/report/components/report-fields";
import { Button } from "@/components/ui/button";

/**
 * 投稿の取り下げ。編集画面の末尾に置く。
 *
 * ⚠️ **編集フォームの中に入れない**。ボタンが submit として拾われうるうえ、
 * 「直す」ための画面の主目的とは別の操作なので、枠を分けて下に置く。
 *
 * 取り消せない操作なので、押す前に何が消えるかを確認のダイアログで見せる
 * （新規投稿の確認画面・追記と同じ形。`<dialog>` は ESC とフォーカス管理が付いてくる）。
 */
export function ReportWithdraw({ reportId, title }: { reportId: string; title: string }) {
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errors, setErrors] = useState<{ message: string }[]>([]);

  async function handleWithdraw() {
    confirmRef.current?.close();
    setWithdrawing(true);
    setErrors([]);
    // 成功時はアクション側が投稿者のページへ redirect する（この投稿はもう無い）
    const result = await withdrawOwnReport(reportId);
    if (result.error !== undefined) {
      setErrors([{ message: result.error }]);
      setWithdrawing(false);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900">投稿を取り下げる</h2>
      <p className="mt-1 text-sm text-gray-600">
        指摘そのものが誤りだった場合は、投稿を取り下げられます。
        <strong>投稿・添付画像・この投稿に付いた賛同がすべて削除され、元に戻せません。</strong>
      </p>

      <ErrorPanel errors={errors} />

      <Button
        type="button"
        onClick={() => confirmRef.current?.showModal()}
        disabled={withdrawing}
        variant="dangerOutline"
        // 枠線だけ既定（red-300）より濃くする。取り消せない操作の入口なので、
        // 管理画面の「削除」と同じ強さでは弱い
        className="mt-3 px-6 border-red-700"
      >
        取り下げる
      </Button>

      <dialog
        ref={confirmRef}
        className="m-auto max-h-[90dvh] w-[90vw] max-w-lg rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="space-y-4 rounded-lg bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">この投稿を取り下げます</h2>
          {/* 何を消すのかを名前で見せる（一覧から来て別の投稿を開いている取り違えを防ぐ） */}
          <p className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800">{title}</p>
          <p className="text-sm text-gray-700">
            投稿・添付画像・この投稿に付いた賛同がすべて削除されます。
            <strong>取り消せません。</strong>
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => confirmRef.current?.close()}
              variant="secondary"
              className="px-6"
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing}
              variant="danger"
              className="px-6"
            >
              {withdrawing ? "取り下げ中..." : "取り下げる"}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
