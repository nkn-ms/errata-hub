"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteOwnReportImage, updateOwnReport } from "@/app/actions/report";
import { routes } from "@/constants/routes";
import {
  ErrorPanel,
  MediumFields,
  ReportContentFields,
  reportFieldsErrors,
  toReportBody,
  type ReportFieldsValue,
} from "@/components/report-fields";
import {
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_MB,
  REPORT_IMAGE_MAX_SOURCE_MB,
} from "@/constants/report-images";
import { selectReportImages } from "@/utils/report-image-select";

type BookSummary = {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

export type ReportImageItem = { id: string; imageUrl: string };

type Props = {
  reportId: string;
  book: BookSummary;
  initialFields: ReportFieldsValue;
  initialImages: ReportImageItem[];
};

// 入力欄は新規投稿と共有している = report-fields.tsx
//
// 新規投稿にあって、ここに**意図的に無いもの**（コードからは読み取れないので残す）:
//   - 書籍の選び直し … 本が変わるなら別の投稿
//   - 確認画面 … 直しに来た人は自分が何を書いたか既に知っている（編集は何度でもやり直せる）
export function ReportEditForm({ reportId, book, initialFields, initialImages }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<ReportFieldsValue>(initialFields);
  const patchFields = (patch: Partial<ReportFieldsValue>) =>
    setFields((prev) => ({ ...prev, ...patch }));
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 画像も**「更新する」で確定する**（この画面で押すボタンは1つ、が守るべき形）。
  // 選んだ瞬間に送ってしまうと、押していないのに反映済み・キャンセルしても戻らない、という
  // フォームとして筋の通らない状態になる。そのため2つに分けて持つ:
  //   removedIds … 「更新する」で消す既存の画像（⚠️ 一覧からは外さない。外すと「消えた」のか
  //                「壊れた」のか区別が付かず、押し間違いも戻せない。薄く出して元に戻せるようにする）
  //   added      … 「更新する」で送る新しい画像（送るまではローカルの blob URL）
  const [images, setImages] = useState<ReportImageItem[]>(initialImages);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<{ file: File; previewUrl: string }[]>([]);
  const [compressing, setCompressing] = useState(false);
  const isRemoved = (imageId: string) => removedIds.includes(imageId);
  // 枠を数えるのは「残す画像＋これから足す画像」（消す印を付けた分は空きとして扱う）
  const imageCount = images.length - removedIds.length + added.length;

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルの再選択でも change を発火させる
    setErrors([]);
    setCompressing(true);
    try {
      const selected = await selectReportImages(files, REPORT_IMAGE_MAX_COUNT - imageCount);
      setErrors(selected.error ? [{ message: selected.error }] : []);
      setAdded((prev) => [
        ...prev,
        ...selected.accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]);
    } finally {
      setCompressing(false);
    }
  }

  // 画像の削除は取り消せないので、確定の前に**何が消えるか**を見せて確かめる
  // （管理画面の同じ操作には前からあった＝一般ユーザーが触るこちらの面だけ緩かった）。
  // ⚠️ 消す画像が無いときは出さない。本文を直しに来ただけの人に確認を挟まない
  const confirmRef = useRef<HTMLDialogElement>(null);
  const removedImages = images.filter((image) => isRemoved(image.id));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = reportFieldsErrors(fields);
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    setErrors([]);

    if (removedImages.length > 0) {
      confirmRef.current?.showModal();
      return;
    }
    void save();
  }

  async function save() {
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await updateOwnReport(reportId, toReportBody(fields));
      if (result.error !== undefined) {
        setErrors([{ message: result.error }]);
        return;
      }

      // 画像は本文の保存が通ってから反映する。**削除 → 追加の順**（逆にすると、入れ替えのときに
      // 一時的に上限を超えて追加が弾かれる）。
      // 途中で落ちたら、やり残した分だけを state に残してから知らせる
      // ＝もう一度「更新する」を押せば続きからやり直せる（成功した分を二重に処理しない）。
      const pendingRemovals = [...removedIds];
      for (const id of removedIds) {
        const deleted = await deleteOwnReportImage(id);
        if (deleted.error !== undefined) {
          setRemovedIds(pendingRemovals);
          setErrors([{ message: deleted.error }]);
          return;
        }
        pendingRemovals.shift();
      }
      setImages((prev) => prev.filter((image) => !removedIds.includes(image.id)));
      setRemovedIds([]);

      const pendingUploads = [...added];
      for (const { file, previewUrl } of added) {
        const formData = new FormData();
        formData.append("file", file);
        // 画像だけは Server Actions ではなく API Route（ボディ上限のため = design.md §7）
        const response = await fetch(routes.api.reportImages(reportId), {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          // サーバーの文言をそのまま出す（枚数超過・レート制限で次にすべきことが違う）
          const body: { error?: string } | null = await response.json().catch(() => null);
          setAdded(pendingUploads);
          setErrors([{ message: body?.error ?? "画像のアップロードに失敗しました" }]);
          return;
        }
        pendingUploads.shift();
        URL.revokeObjectURL(previewUrl);
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

        <div>
          {/* ここを <label> にしない理由は report-form.tsx のコメント（下の「ファイルを選択」が
              input のラベルを兼ねており、label が2つあると読み上げの解決が曖昧になる） */}
          <p className="block text-sm font-medium text-gray-700 mb-1">
            画像（任意・{REPORT_IMAGE_MAX_COUNT}枚まで）
          </p>
          <p className="text-xs text-gray-500 mb-2">
            追加・削除はどちらも「更新する」で確定します。
          </p>

          {(images.length > 0 || added.length > 0) && (
            <div className="mb-3 flex flex-wrap gap-3">
              {images.map((image) => (
                <div key={image.id} className="relative">
                  <a href={image.imageUrl} target="_blank" rel="noopener noreferrer">
                    <Image
                      src={image.imageUrl}
                      alt="証拠画像"
                      width={96}
                      height={128}
                      unoptimized
                      className={`h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 cursor-zoom-in ${
                        isRemoved(image.id) ? "opacity-30" : ""
                      }`}
                    />
                  </a>
                  {isRemoved(image.id) && (
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gray-900/80 py-1 text-center text-xs text-white">
                      削除予定
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setRemovedIds((prev) =>
                        isRemoved(image.id)
                          ? prev.filter((id) => id !== image.id)
                          : [...prev, image.id]
                      )
                    }
                    aria-label={isRemoved(image.id) ? "この画像の削除をやめる" : "この画像を削除"}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 cursor-pointer"
                  >
                    {isRemoved(image.id) ? "↩" : "×"}
                  </button>
                </div>
              ))}
              {added.map(({ file, previewUrl }, index) => (
                <div key={previewUrl} className="relative">
                  {/* 選択中ファイルのローカルプレビュー（blob: URL）なので next/image は使わない */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAdded((prev) => {
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

          {imageCount < REPORT_IMAGE_MAX_COUNT && (
            <>
              {/* input を隠して <label> をボタンとして見せる理由は report-form.tsx のコメント */}
              <input
                id="images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelect}
                disabled={compressing || submitting}
                className="peer sr-only"
              />
              <label
                htmlFor="images"
                className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
              >
                ファイルを選択
              </label>
              <p className="mt-2 text-xs text-gray-500">
                該当箇所が分かる画像や、指摘の根拠となる資料を、指摘に必要な範囲で添付してください
                （JPEG / PNG / WebP・1枚{REPORT_IMAGE_MAX_SOURCE_MB}MBまで）。大きい画像は自動で縮小され、
                縮小後に{REPORT_IMAGE_MAX_MB}MBを超えるものは添付できません。
              </p>
            </>
          )}
          {compressing && <p className="mt-2 text-xs text-gray-500">画像を処理しています…</p>}
        </div>
      </section>

      <ErrorPanel errors={errors} />

      {/* 消す画像を見せてから確かめる（新規投稿の確認画面・追記と同じ形）。
          ⚠️ **この form の中に置いてよいのは、中のボタンを両方 type="button" にしているから**。
             既定の type="submit" のままだと、確認のつもりで押した瞬間に送信が走る */}
      <dialog
        ref={confirmRef}
        className="m-auto max-h-[90dvh] w-[90vw] max-w-lg rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="space-y-4 rounded-lg bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            画像{removedImages.length}枚を削除します
          </h2>
          <div className="flex flex-wrap gap-2">
            {removedImages.map((image) => (
              <Image
                key={image.id}
                src={image.imageUrl}
                alt="削除する画像"
                width={96}
                height={128}
                unoptimized
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50"
              />
            ))}
          </div>
          <p className="text-sm text-gray-700">
            削除した画像は<strong>元に戻せません。</strong>本文の変更も一緒に保存されます。
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
              onClick={() => {
                confirmRef.current?.close();
                void save();
              }}
              disabled={submitting}
              className="px-6 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              削除して更新する
            </button>
          </div>
        </div>
      </dialog>

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
