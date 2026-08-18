"use client";

import { useRef, useState } from "react";
import { deletePublisherComment } from "@/features/report/actions/publisher-comment";
import type { PublisherCommentView } from "@/features/report/types";

// 削除は取り消せないので確認を挟む。⚠️ `confirm()` は使わない
// （<dialog> なら ESC とフォーカス管理が付いてくる＝投稿の追記・出版社の回答と同じ作法）
type Props = {
  comments: PublisherCommentView[];
};

export function AdminPublisherCommentList({ comments }: Props) {
  // 「どれを消そうとしているか」を確認ダイアログにそのまま出すため、対象を持つ
  const [target, setTarget] = useState<PublisherCommentView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLDialogElement>(null);

  function openConfirm(comment: PublisherCommentView) {
    setTarget(comment);
    setError("");
    confirmRef.current?.showModal();
  }

  async function handleDelete() {
    if (!target) return;
    confirmRef.current?.close();
    setDeleting(true);
    setError("");
    // 成功時はアクション側の refresh() でこのページが描き直される（一覧はここで持たない）
    const result = await deletePublisherComment(target.id);
    if (result.error !== undefined) {
      setError(result.error);
    }
    setDeleting(false);
    setTarget(null);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">出版社からの回答</h2>
        <p className="mt-1 text-xs text-gray-500">
          回答は書いた本人も取り消せません（規約 第8条3項）。ここでの削除は規約 第10条1項に基づく
          モデレーションの措置です。回答を書くには公開ページの投稿詳細を開いてください。
        </p>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-500">まだ回答はありません。</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{comment.publisherName}</span>
                  {comment.byAdmin && <span>（運営者が代理で記載）</span>}
                  <span className="tabular-nums">{comment.createdAt}</span>
                </p>
                <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap">{comment.body}</p>
              </div>
              <button
                type="button"
                onClick={() => openConfirm(comment)}
                disabled={deleting}
                className="shrink-0 px-3 py-1 text-xs text-red-700 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {/* ⚠️ ただの「削除」にしない。同じ画面に投稿そのものの「削除」があり、
                    どちらを押すのか区別できない（添付画像の「この画像を削除」と同じ理由） */}
                この回答を削除
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <dialog
        ref={confirmRef}
        className="m-auto max-h-[90dvh] w-[90vw] max-w-lg rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="space-y-4 rounded-lg bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">この回答を削除します</h2>
          {target && (
            <>
              <p className="text-xs text-gray-500">
                {target.publisherName}
                {target.byAdmin && "（運営者が代理で記載）"} {target.createdAt}
              </p>
              <p className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                {target.body}
              </p>
            </>
          )}
          <p className="text-xs text-gray-500">この操作は取り消せません。</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                confirmRef.current?.close();
                setTarget(null);
              }}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-6 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {deleting ? "削除中..." : "削除する"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
