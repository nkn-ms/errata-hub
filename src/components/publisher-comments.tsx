"use client";

import { useRef, useState, type FormEvent } from "react";
import { addPublisherComment } from "@/app/actions/publisher-comment";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { CharCounter, ErrorPanel } from "@/components/report-fields";
import type { PublisherCommentView } from "@/types/report";

// ⚠️ 一覧と入力欄を1つのクライアント部品にまとめてある理由は components/report-addenda.tsx と同じ
// （成功後に refresh() すると再描画が入力欄の DOM ごと差し替え、打ちかけの文字が消える）。
type Props = {
  reportId: string;
  initialComments: PublisherCommentView[];
  // 回答できるときだけ渡す（＝入力欄を出す条件そのもの）。判定は services/publisher-access.ts。
  // **誰として書くことになるか**を添えるのは、送る前に画面で確かめられるようにするため
  commentAs?: { publisherName: string; byAdmin: boolean };
};

export function PublisherComments({ reportId, initialComments, commentAs }: Props) {
  const [comments, setComments] = useState<PublisherCommentView[]>(initialComments);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // 回答は取り消せないので、送る前に何を送るかを見せて確かめる（追記・新規投稿と同じ形）
  const confirmRef = useRef<HTMLDialogElement>(null);

  if (comments.length === 0 && !commentAs) return null;

  // 「確認する」= 検証だけして確認のダイアログを開く。ここではまだ何も送らない
  function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setErrors([{ field: "publisher-comment", message: "回答を入力してください" }]);
      return;
    }
    setErrors([]);
    confirmRef.current?.showModal();
  }

  async function handleSubmit() {
    // 先に閉じる: 失敗の知らせはページ側の ErrorPanel に出す（同じことを2か所で言わない）
    confirmRef.current?.close();
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await addPublisherComment(reportId, { body });
      if (result.error !== undefined) {
        setErrors([{ message: result.error }]);
        return;
      }
      setComments((prev) => [...prev, result.comment]);
      setBody("");
    } catch {
      setErrors([{ message: "回答の投稿に失敗しました。もう一度お試しください。" }]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ⚠️ 見出しのある領域にしてあるのは飾りではない。確認ダイアログにも同じ本文が入るので、
          「一覧に載ったか」を**この領域の中**で見ないと、送る前の確認と区別が付かない */}
      {comments.length > 0 && (
        <section aria-labelledby="publisher-comments-heading">
          <p id="publisher-comments-heading" className="text-xs text-gray-500 mb-2">
            出版社からの回答
          </p>
          <div className="divide-y divide-blue-100 rounded-md border border-blue-200 bg-blue-50">
            {comments.map((comment) => (
              <div key={comment.id} className="px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-blue-700">
                  <span className="font-medium">{comment.publisherName}</span>
                  {/* 規約 第8条4項が運営者に課している明示義務の実体。黙って代筆しない */}
                  {comment.byAdmin && <span>（運営者が代理で記載）</span>}
                  <span className="tabular-nums">{comment.createdAt}</span>
                </p>
                <p className="mt-0.5 text-sm text-blue-900 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {commentAs && (
        <form
          onSubmit={handleConfirm}
          className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <div>
            <label
              htmlFor="publisher-comment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              出版社として回答する
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {commentAs.byAdmin
                ? `${commentAs.publisherName} の回答を、運営者が代理で記載します。代理記載であることは公開ページに表示されます。`
                : `${commentAs.publisherName} として回答できます。`}
              回答は公開ページに表示され、後から編集・削除できません。
            </p>
            <textarea
              id="publisher-comment"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              // 送信中は入力欄も止める（理由は report-addenda.tsx と同じ）
              disabled={submitting}
              maxLength={REPORT_LIMITS.publisherComment}
              aria-describedby="publisher-comment-count"
              rows={3}
              placeholder="例: ご指摘の箇所は誤りでした。第3刷で修正いたします。"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <CharCounter
              id="publisher-comment-count"
              value={body}
              max={REPORT_LIMITS.publisherComment}
            />
          </div>

          <ErrorPanel errors={errors} />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">回答した内容は取り消せません。</p>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {submitting ? "送信中..." : "確認する"}
            </button>
          </div>
        </form>
      )}

      {/* 送る直前の確認。⚠️ form の外に置く（中に入れるとボタンが submit として拾われうる）。
          出すのは**これから送るものそのもの**で、別に組み立て直さない */}
      <dialog
        ref={confirmRef}
        className="m-auto max-h-[90dvh] w-[90vw] max-w-lg rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="space-y-4 rounded-lg bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">この内容で回答します</h2>
          {commentAs && (
            <p className="text-xs text-gray-500">
              {commentAs.publisherName}
              {commentAs.byAdmin && "（運営者が代理で記載）"}
            </p>
          )}
          <p className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
            {body}
          </p>
          <p className="text-xs text-gray-500">
            回答した内容は取り消せません。公開ページに表示されます。
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => confirmRef.current?.close()}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "送信中..." : "回答する"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
