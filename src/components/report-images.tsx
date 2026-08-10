"use client";

import { useState, type ChangeEvent } from "react";
import Image from "next/image";
import { deleteOwnReportImage } from "@/app/actions/report";
import { routes } from "@/constants/routes";
import { ErrorPanel } from "@/components/report-fields";
import {
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_SOURCE_MB,
} from "@/constants/report-images";
import { selectReportImages } from "@/utils/report-image-select";

export type ReportImageItem = { id: string; imageUrl: string };

type Props = {
  reportId: string;
  initialImages: ReportImageItem[];
  // 追加は**連絡後も**できる（追記と同じで、足すだけなら出版社が見た内容は変わらない）。
  canAdd: boolean;
  // 削除は連絡前だけ。本文を凍結しても根拠を消せるなら、出版社が見た内容は結局変わってしまう。
  canDelete: boolean;
};

/**
 * 投稿の証拠画像。閲覧者には一覧を、投稿者本人には追加・削除の手段を出す。
 *
 * ⚠️ **編集画面（/reports/[id]/edit）ではなくここに置いてある。** あの画面は PENDING の間しか
 * 開かないが、画像の追加は連絡後も認めるため、置くと「連絡後は追加できない」ことになってしまう。
 *
 * 一覧を state で持つのは、追加・削除の結果をその場で反映するため（サーバー側の再描画に
 * 頼らない＝アップロード中の状態や選択中のファイルを巻き込まない）。
 */
export function ReportImages({ reportId, initialImages, canAdd, canDelete }: Props) {
  const [images, setImages] = useState<ReportImageItem[]>(initialImages);
  const [error, setError] = useState("");
  // 圧縮とアップロードの両方を覆う。終わるまで次の選択をさせない（枚数の数え違いを防ぐ）
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  if (images.length === 0 && !canAdd) return null;

  async function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルの再選択でも change を発火させる
    setError("");
    setBusy(true);
    try {
      const selected = await selectReportImages(files, REPORT_IMAGE_MAX_COUNT - images.length);
      setError(selected.error);

      // 投稿フォームと同じく1リクエスト1ファイルで直列に送る（Vercel のボディ上限）。
      // 1枚ごとに一覧へ足すので、途中で失敗しても成功した分は画面に残る。
      for (const file of selected.accepted) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(routes.api.reportImages(reportId), {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          // サーバーの文言をそのまま出す（枚数超過・レート制限で理由が違い、
          // 「失敗しました」だけだと利用者が次に何をすればよいか分からない）
          const body: { error?: string } | null = await response.json().catch(() => null);
          setError(body?.error ?? "画像のアップロードに失敗しました");
          break; // 上限・レート制限なら後続も同じ理由で落ちる
        }
        const created: ReportImageItem = await response.json();
        setImages((prev) => [...prev, created]);
      }
    } catch {
      setError("画像のアップロードに失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(imageId: string) {
    // 取り消せない操作なので確認を挟む（管理画面の画像削除・投稿削除と同じ扱い）
    if (!confirm("この画像を削除します。取り消せません。よろしいですか？")) return;
    setDeletingId(imageId);
    setError("");
    try {
      const result = await deleteOwnReportImage(imageId);
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setImages((prev) => prev.filter((image) => image.id !== imageId));
    } catch {
      setError("画像の削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">証拠画像</p>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((image) => (
            <div key={image.id} className="w-32">
              <a href={image.imageUrl} target="_blank" rel="noopener noreferrer">
                <Image
                  src={image.imageUrl}
                  alt="証拠画像"
                  width={128}
                  height={180}
                  unoptimized
                  className="w-32 h-auto rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                />
              </a>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  disabled={deletingId === image.id}
                  className="mt-1 text-xs text-red-700 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {deletingId === image.id ? "削除中..." : "この画像を削除"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 上限に達したら選択の手段ごと消す（投稿フォームと同じ）。枚数は一覧が示している */}
      {canAdd && images.length < REPORT_IMAGE_MAX_COUNT && (
        <div className="mt-3">
          {/* input を隠して <label> をボタンとして見せる理由は report-form.tsx のコメント */}
          <input
            id="report-images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleSelect}
            disabled={busy}
            className="peer sr-only"
          />
          <label
            htmlFor="report-images"
            className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
          >
            画像を追加
          </label>
          <p className="mt-2 text-xs text-gray-500">
            該当箇所が分かる画像や、指摘の根拠となる資料を、指摘に必要な範囲で添付してください
            （JPEG / PNG / WebP・1枚{REPORT_IMAGE_MAX_SOURCE_MB}MBまで・{REPORT_IMAGE_MAX_COUNT}枚まで）。
          </p>
        </div>
      )}
      {busy && <p className="mt-2 text-xs text-gray-500">画像を処理しています…</p>}

      {error && (
        <div className="mt-3">
          <ErrorPanel errors={[{ message: error }]} />
        </div>
      )}
    </div>
  );
}
