"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { deleteReportAddendum } from "@/features/report/actions/delete";
import { Button } from "@/components/ui/button";
import { RecordId } from "./record-id";

// 削除は取り消せないので確認を挟む。⚠️ `confirm()` は使わない
// （<dialog> なら ESC とフォーカス管理が付いてくる＝出版社の回答の一覧と同じ作法）

export type AdminAddendum = {
  id: string;
  body: string;
  /** 表示用に整形済み（JST・日付＋時刻） */
  createdAt: string;
  images: { id: string; imageUrl: string }[];
};

export function AdminAddendumList({ addenda }: { addenda: AdminAddendum[] }) {
  // 「どれを消そうとしているか」を確認ダイアログにそのまま出すため、対象を持つ
  const [target, setTarget] = useState<AdminAddendum | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLDialogElement>(null);

  function openConfirm(addendum: AdminAddendum) {
    setTarget(addendum);
    setError("");
    confirmRef.current?.showModal();
  }

  async function handleDelete() {
    if (!target) return;
    confirmRef.current?.close();
    setDeleting(true);
    setError("");
    // 成功時はアクション側の refresh() でこのページが描き直される（一覧はここで持たない）
    const result = await deleteReportAddendum(target.id);
    if (result.error !== undefined) {
      setError(result.error);
    }
    setDeleting(false);
    setTarget(null);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">追記</h2>
        <p className="mt-1 text-xs text-gray-500">
          出版社や著者へ連絡した後に投稿者が足したものです。投稿者は自分でも消せません（連絡した内容と
          食い違わないようにするため）。ここでの削除は規約 第10条1項に基づくモデレーションの措置です。
        </p>
      </div>

      {addenda.length === 0 ? (
        <p className="text-sm text-gray-500">まだ追記はありません。</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {addenda.map((addendum) => (
            <div key={addendum.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
                  <span className="tabular-nums">{addendum.createdAt}</span>
                  <RecordId value={addendum.id} />
                </p>
                <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap">{addendum.body}</p>
                {/* 添えた画像も出す。本文だけ見て判断すると、画像側の侵害を見落とす */}
                {addendum.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {addendum.images.map((image) => (
                      <a
                        key={image.id}
                        href={image.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Image
                          src={image.imageUrl}
                          alt="追記に添えられた画像"
                          width={64}
                          height={90}
                          unoptimized
                          className="w-16 h-auto self-start rounded border border-gray-200"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={() => openConfirm(addendum)}
                disabled={deleting}
                variant="dangerOutline"
                className="shrink-0 px-3 py-1 text-xs"
              >
                {/* ⚠️ ただの「削除」にしない。同じ画面に投稿そのものの「削除」があり、
                    どちらを押すのか区別できない（出版社の回答・添付画像と同じ理由） */}
                この追記を削除
              </Button>
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
          <h2 className="text-base font-semibold text-gray-900">この追記を削除します</h2>
          {target && (
            <>
              <p className="text-xs text-gray-500 tabular-nums">{target.createdAt}</p>
              <p className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                {target.body}
              </p>
              {target.images.length > 0 && (
                <p className="text-xs text-gray-500">
                  添えられた画像 {target.images.length} 枚も一緒に削除されます。
                </p>
              )}
            </>
          )}
          <p className="text-xs text-gray-500">この操作は取り消せません。</p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => {
                confirmRef.current?.close();
                setTarget(null);
              }}
              variant="secondary"
              className="px-6"
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              variant="danger"
              className="px-6"
            >
              {deleting ? "削除中..." : "削除する"}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
