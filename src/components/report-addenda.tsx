"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { addReportAddendum, type Addendum } from "@/app/actions/report";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { CharCounter, ErrorPanel } from "@/components/report-fields";
import { routes } from "@/constants/routes";
import {
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_MB,
  REPORT_IMAGE_MAX_SOURCE_MB,
} from "@/constants/report-images";
import { selectReportImages } from "@/utils/report-image-select";

// ⚠️ **一覧と入力欄を1つのクライアント部品にまとめてあるのは、書きかけを失わないため。**
// 成功後に refresh() で描き直すと、再描画が**入力欄の DOM ノードごと差し替える**
// （実測: textarea に付けた目印が消える）。そのとき打っていた文字は失われる。
// なので refresh() せず、返ってきた行をこの部品の中で足す。
type Props = {
  reportId: string;
  initialAddenda: Addendum[];
  canAdd: boolean;
  // 投稿全体で持てる残り枚数。上限は投稿単位なので、本体の画像と追記の画像を合わせて数える
  remainingImageSlots: number;
};

export function ReportAddenda({ reportId, initialAddenda, canAdd, remainingImageSlots }: Props) {
  const [addenda, setAddenda] = useState<Addendum[]>(initialAddenda);
  const [body, setBody] = useState("");
  // 追記と一緒に送る画像。本文と同じで「追記する」を押すまでは送らない
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const remaining = remainingImageSlots - images.length;

  if (addenda.length === 0 && !canAdd) return null;

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルの再選択でも change を発火させる
    setErrors([]);
    setCompressing(true);
    try {
      const selected = await selectReportImages(files, remaining);
      setErrors(selected.error ? [{ message: selected.error }] : []);
      setImages((prev) => [
        ...prev,
        ...selected.accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]);
    } finally {
      setCompressing(false);
    }
  }

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

      // 画像は追記を作ってから、その追記に紐づけて送る（本体の証拠画像と混ぜない）。
      // ⚠️ 追記は不変なので、ここで失敗した分を後からこの追記に足すことはできない。
      //    追記自体は保存されている＝「何が起きたか」をそのまま伝えて、やり直しは別の追記に委ねる。
      const uploaded: { id: string; imageUrl: string }[] = [];
      let failedCount = 0;
      for (const { file, previewUrl } of images) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("addendumId", result.addendum.id);
        const response = await fetch(routes.api.reportImages(reportId), {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          failedCount++;
          continue;
        }
        uploaded.push(await response.json());
        URL.revokeObjectURL(previewUrl);
      }

      setAddenda((prev) => [...prev, { ...result.addendum, images: uploaded }]);
      setBody("");
      setImages([]);
      if (failedCount > 0) {
        setErrors([
          {
            message: `追記は保存しましたが、画像${failedCount}枚は添付できませんでした。もう一度追記して添付し直してください。`,
          },
        ]);
      }
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
                {/* 画像はその追記の中に置く。ここが本体の「証拠画像」と分かれている意味 */}
                {addendum.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {addendum.images.map((image) => (
                      <a key={image.id} href={image.imageUrl} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={image.imageUrl}
                          alt="追記の画像"
                          width={96}
                          height={128}
                          unoptimized
                          className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 hover:opacity-80 transition-opacity cursor-zoom-in"
                        />
                      </a>
                    ))}
                  </div>
                )}
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

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">画像（任意）</p>
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map(({ file, previewUrl }, index) => (
                  <div key={previewUrl} className="relative">
                    {/* 送信前のローカルプレビュー（blob: URL）なので next/image は使わない */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-24 w-auto rounded border border-gray-200 object-contain bg-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => {
                          URL.revokeObjectURL(prev[index].previewUrl);
                          return prev.filter((_, i) => i !== index);
                        })
                      }
                      aria-label={`${file.name} を削除`}
                      className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {remaining > 0 ? (
              <>
                {/* input を隠して <label> をボタンとして見せる理由は report-form.tsx のコメント */}
                <input
                  id="addendum-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  disabled={compressing || submitting}
                  className="peer sr-only"
                />
                <label
                  htmlFor="addendum-images"
                  className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
                >
                  ファイルを選択
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  JPEG / PNG / WebP・1枚{REPORT_IMAGE_MAX_SOURCE_MB}MBまで（縮小後に
                  {REPORT_IMAGE_MAX_MB}MBを超えるものは添付できません）。あと{remaining}枚まで。
                </p>
              </>
            ) : (
              // 上限は投稿単位。連絡後は本体の画像を消せないので、ここで打ち止めになることがある
              <p className="text-xs text-gray-500">
                画像は1件の投稿につき{REPORT_IMAGE_MAX_COUNT}枚までです。
              </p>
            )}
            {compressing && <p className="mt-2 text-xs text-gray-500">画像を処理しています…</p>}
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
