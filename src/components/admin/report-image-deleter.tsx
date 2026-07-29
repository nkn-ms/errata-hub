"use client";

import { useState } from "react";
import Image from "next/image";
import { deleteReportImage } from "@/app/actions/report";

/**
 * 添付画像1枚と、その削除ボタン（管理者のみ）。
 *
 * 権利者から「この画像だけ消してほしい」と言われたときに、投稿ごと消さずに応えるための手段
 * （docs/moderation-policy.md の「部分マスキング」と同じ系統）。
 * 取り消せない操作なので、押し間違い対策に確認ダイアログを挟む（投稿削除と同じ扱い）。
 */
export function ReportImageDeleter({ imageId, imageUrl }: { imageId: string; imageUrl: string }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm("この画像を削除します。取り消せません。よろしいですか？")) return;
    setDeleting(true);
    setError("");
    const result = await deleteReportImage(imageId);
    // 成功時は Server Action 側の refresh() で画像ごと消えるので、状態は戻さない
    if (result.error) {
      setError(result.error);
      setDeleting(false);
    }
  }

  return (
    <div className="w-32">
      <a href={imageUrl} target="_blank" rel="noopener noreferrer">
        {/* 自前 Storage 由来だが書影と同じ unoptimized 恒久運用に合わせる */}
        <Image
          src={imageUrl}
          alt="添付画像"
          width={128}
          height={180}
          unoptimized
          className="w-32 h-auto rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
        />
      </a>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="mt-1 text-xs text-red-700 hover:underline disabled:opacity-50 disabled:no-underline"
      >
        {deleting ? "削除中..." : "この画像を削除"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
