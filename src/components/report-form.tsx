"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookSearch } from "@/components/book-search";
import { findErratumUrlByIsbn } from "@/app/actions/book";
import { useRouter } from "next/navigation";
import { createReport } from "@/app/actions/report";
import { routes } from "@/constants/routes";
import { toIntOrNull } from "@/utils/parse";
import { TYPE_LABELS, MEDIUM_LABELS } from "@/constants/report-labels";
import { REPORT_LIMITS } from "@/constants/report-limits";
import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
} from "@/constants/report-images";

type BookData = {
  googleBooksId: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

type ReportType = "ERRATA" | "SUGGESTION" | "OTHER";
type Medium = "PAPER" | "EBOOK" | "OTHER";

// 文字数カウンター（「30/2000」）。maxLength に達すると入力できなくなるので、
// 打ち切られる前に残りが見えるようにする。自由記述の欄（タイトル・誤・正・内容/提案・備考）に付け、
// 位置・URL のような「上限まで書くことがそもそも無い」欄には付けない。
//
// 数え方は maxLength と同じ UTF-16 コードユニット（= String#length）なので、表示と
// ブラウザの打ち切りがずれない。
// aria-live は付けない（打鍵のたびに読み上げられて邪魔になる）。textarea の aria-describedby
// から参照させ、フォーカス時に一度読まれる形にしている。
function CharCounter({ id, value, max }: { id: string; value: string; max: number }) {
  return (
    <p id={id} className="mt-1 text-right text-xs text-gray-500 tabular-nums">
      {value.length}/{max}
    </p>
  );
}

type Props = {
  // 書籍ページの「この本に投稿する」から来たとき、その本を確定済みとして受け取る。
  // 渡された場合は書籍検索を出さず、確定表示（編集不可）にする。
  initialBook?: BookData | null;
  initialErratumUrl?: string | null;
};

export function ReportForm({ initialBook = null, initialErratumUrl = null }: Props = {}) {
  const router = useRouter();
  // 書籍が確定済みで来たかどうか。以降「検索欄を出すか」「別の本へ逃げる導線を出すか」の判断に使う
  const bookPreselected = initialBook !== null;
  const [book, setBook] = useState<BookData | null>(initialBook);
  const [edition, setEdition] = useState("");
  const [printing, setPrinting] = useState("");
  const [reportType, setReportType] = useState<ReportType>("ERRATA");
  const [medium, setMedium] = useState<Medium>("PAPER");
  const [page, setPage] = useState("");
  const [line, setLine] = useState("");
  const [hasMultiplePages, setHasMultiplePages] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [ebookLocation, setEbookLocation] = useState("");
  const [title, setTitle] = useState("");
  const [wrong, setWrong] = useState("");
  const [correct, setCorrect] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [reportedErratumUrl, setReportedErratumUrl] = useState("");
  // 選んだ本に公式の正誤表が既に登録されていれば、投稿前にそれを案内する（重複投稿を減らす）
  const [knownErratumUrl, setKnownErratumUrl] = useState<string | null>(initialErratumUrl);
  // File と表示用の object URL をペアで持つ（URL は削除時・投稿後に revoke する）
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルの再選択でも change を発火させる
    setError("");
    const next = [...images];
    for (const file of files) {
      // push する前の空き確認（上限ちょうど＝満杯、なのでこれ以上は追加しない）
      const isFull = next.length >= REPORT_IMAGE_MAX_COUNT;
      if (isFull) {
        setError(`画像は${REPORT_IMAGE_MAX_COUNT}枚までです`);
        break;
      }
      if (!REPORT_IMAGE_ALLOWED_TYPES[file.type]) {
        setError("画像は JPEG / PNG / WebP のみ添付できます");
        continue;
      }
      if (file.size > REPORT_IMAGE_MAX_BYTES) {
        setError("画像は1枚4MB以下にしてください");
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages(next);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const isErrataType = reportType === "ERRATA";
  const isPaper = medium === "PAPER";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!book) { setError("書籍を選択してください"); return; }
    if (!book.isbn) { setError("ISBNのある書籍を選択してください"); return; }
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (medium === "PAPER" && !edition) { setError("版を入力してください"); return; }
    if (medium === "PAPER" && !page) { setError("ページ番号を入力してください"); return; }
    if (medium === "EBOOK" && !ebookLocation.trim()) { setError("位置を入力してください"); return; }
    if (medium === "OTHER" && !locationNote.trim()) { setError("位置メモを入力してください"); return; }
    if (isErrataType) {
      if (!wrong.trim()) { setError("誤（該当箇所）を入力してください"); return; }
      if (!correct.trim()) { setError("正（正しい内容）を入力してください"); return; }
    } else if (!content.trim()) {
      setError("内容・提案を入力してください"); return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 選択中の媒体・種別に関係ない欄は null で送る（切替前の入力残りを送信しない）
      const created = await createReport({
        book,
        edition: isPaper ? toIntOrNull(edition) : null,
        printing: isPaper ? toIntOrNull(printing) : null,
        title,
        type: reportType,
        medium,
        page: isPaper ? toIntOrNull(page) : null,
        line: isPaper ? toIntOrNull(line) : null,
        hasMultiplePages: isPaper && hasMultiplePages,
        locationNote: medium === "EBOOK" ? null : locationNote || null,
        ebookLocation: medium === "EBOOK" ? ebookLocation : null,
        wrong: isErrataType ? wrong : null,
        correct: isErrataType ? correct : null,
        content: isErrataType ? null : content,
        note: note || null,
        reportedErratumUrl: reportedErratumUrl.trim() || null,
      });

      if (created.error !== undefined) {
        setError(created.error);
        return;
      }

      // 画像は投稿の作成後に1枚ずつアップロードする（1リクエスト1ファイル。
      // Server Actions のボディ上限 1MB を超えるため、画像だけは API Route で送る。
      // まとめて送ると Vercel のボディ上限 4.5MB も超えうるため直列送信）。
      if (images.length > 0) {
        let failedCount = 0;
        for (const { file } of images) {
          const formData = new FormData();
          formData.append("file", file);
          const upload = await fetch(routes.api.reportImages(created.id), {
            method: "POST",
            body: formData,
          });
          if (!upload.ok) failedCount++;
        }
        if (failedCount > 0) {
          // 投稿自体は作成済みなのでフォームには留めない（再送信で二重投稿になるため）
          alert(`投稿は作成されましたが、画像${failedCount}枚のアップロードに失敗しました`);
        }
      }
      images.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      router.push(routes.home);
    } catch {
      setError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        投稿の前に、<strong>出版社の公式な正誤表を確認してください</strong>。すでに掲載されている誤りは投稿不要です。
        正誤表がまだ登録されていない場合は、下の「出版社の正誤表URL」欄から登録にご協力ください。
      </p>
      {/* 書籍情報 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">書籍情報</h2>

        <div role="group" aria-labelledby="book-label">
          <span id="book-label" className="block text-sm font-medium text-gray-700 mb-1">
            書籍名 {!bookPreselected && <span className="text-red-500">*</span>}
          </span>
          {bookPreselected && book ? (
            // 確定済みなので検索させない。見た目は検索で選んだ直後と同じカードに揃える
            <div className="space-y-2">
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
                  {book.isbn && <div className="text-xs text-gray-400 mt-0.5">ISBN: {book.isbn}</div>}
                </div>
              </div>
              {/* 誤って別の本のページから来ても詰まないよう、検索し直す導線は残す */}
              <Link href={routes.submit} className="text-xs text-blue-600 hover:underline">
                別の本を選ぶ
              </Link>
            </div>
          ) : (
            <BookSearch
              onSelect={async (selected) => {
                setBook(selected);
                setKnownErratumUrl(null);
                if (selected.isbn) {
                  const { erratumUrl } = await findErratumUrlByIsbn(selected.isbn);
                  setKnownErratumUrl(erratumUrl);
                }
              }}
            />
          )}
          {knownErratumUrl && (
            <p className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
              この本には出版社の正誤表があります。
              <a
                href={knownErratumUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline font-medium"
              >
                正誤表を確認する →
              </a>
              <br />
              すでに掲載されている誤りは投稿不要です。
            </p>
          )}
        </div>

        <div role="group" aria-labelledby="medium-label">
          <span id="medium-label" className="block text-sm font-medium text-gray-700 mb-2">読んだ媒体</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MEDIUM_LABELS) as Medium[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMedium(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  medium === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                }`}
              >
                {MEDIUM_LABELS[m]}
              </button>
            ))}
          </div>
          {medium === "EBOOK" && (
            <p className="mt-2 text-xs text-blue-600">
              電子書籍は出版社の修正で内容が更新されることがあります。ダウンロード・更新した時期が分かれば備考に記載してください。
            </p>
          )}
        </div>

        {isPaper && (
        <div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="edition" className="block text-sm font-medium text-gray-700 mb-1">
              版 <span className="text-red-500">*</span>
            </label>
            <input
              id="edition"
              type="number"
              min={1}
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              placeholder="例: 1"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="printing" className="block text-sm font-medium text-gray-700 mb-1">刷（任意）</label>
            <input
              id="printing"
              type="number"
              min={1}
              value={printing}
              onChange={(e) => setPrinting(e.target.value)}
              placeholder="例: 2"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">版・刷は奥付（本の最後のページ）に記載されています。</p>
        </div>
        )}
      </section>

      {/* 投稿内容 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">投稿内容</h2>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={REPORT_LIMITS.title}
            aria-describedby="title-count"
            placeholder="例: p.42「わたし」→「私」の誤植"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <CharCounter id="title-count" value={title} max={REPORT_LIMITS.title} />
        </div>

        <div role="group" aria-labelledby="type-label">
          <span id="type-label" className="block text-sm font-medium text-gray-700 mb-2">種別</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  reportType === t
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 位置情報（読んだ媒体に応じて入力欄が変わる） */}
        {medium === "PAPER" && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-200">
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="page" className="block text-sm font-medium text-gray-700 mb-1">
                  ページ番号 <span className="text-red-500">*</span>
                </label>
                <input
                  id="page"
                  type="number"
                  min={1}
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder="例: 42"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-1">行番号（任意）</label>
                <input
                  id="line"
                  type="number"
                  min={1}
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  placeholder="例: 3"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMultiplePages}
                onChange={(e) => setHasMultiplePages(e.target.checked)}
                className="rounded border-gray-300"
              />
              複数ページにまたがる
            </label>
            {hasMultiplePages && (
              <p className="text-xs text-blue-600 -mt-1">
                ページ範囲を位置備考に入力してください（例: 42〜44、または 42, 43, 44）
              </p>
            )}
            <div>
              <label htmlFor="location-note" className="block text-sm font-medium text-gray-700 mb-1">位置備考（任意）</label>
              <input
                id="location-note"
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                maxLength={REPORT_LIMITS.locationNote}
                placeholder={hasMultiplePages ? "例: 42〜44、または 42, 43, 44" : "例: ページ中央の図、p.102にも同様の誤りあり"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {medium === "EBOOK" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label htmlFor="ebook-location" className="block text-sm font-medium text-gray-700 mb-1">
              位置 <span className="text-red-500">*</span>
            </label>
            <input
              id="ebook-location"
              type="text"
              value={ebookLocation}
              onChange={(e) => setEbookLocation(e.target.value)}
              maxLength={REPORT_LIMITS.ebookLocation}
              placeholder="例: 位置No.1234、43%、p.42"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {medium === "OTHER" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label htmlFor="location-memo" className="block text-sm font-medium text-gray-700 mb-1">
              位置メモ <span className="text-red-500">*</span>
            </label>
            <input
              id="location-memo"
              type="text"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              maxLength={REPORT_LIMITS.locationNote}
              placeholder="例: 第3章「◯◯」の節、サンプルコードzip内のreadme"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 誤→正 or 内容 */}
        {isErrataType ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="wrong" className="block text-sm font-medium text-gray-700 mb-1">
                誤（該当箇所） <span className="text-red-500">*</span>
              </label>
              <textarea
                id="wrong"
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                maxLength={REPORT_LIMITS.wrong}
                aria-describedby="wrong-count"
                rows={2}
                placeholder="誤りのある文章をそのまま入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <CharCounter id="wrong-count" value={wrong} max={REPORT_LIMITS.wrong} />
            </div>
            <div>
              <label htmlFor="correct" className="block text-sm font-medium text-gray-700 mb-1">
                正（正しい内容） <span className="text-red-500">*</span>
              </label>
              <textarea
                id="correct"
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                maxLength={REPORT_LIMITS.correct}
                aria-describedby="correct-count"
                rows={2}
                placeholder="正しいと思われる内容を入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <CharCounter id="correct-count" value={correct} max={REPORT_LIMITS.correct} />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              内容・提案 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={REPORT_LIMITS.content}
              aria-describedby="content-count"
              rows={4}
              placeholder="気になる点や改善提案を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <CharCounter id="content-count" value={content} max={REPORT_LIMITS.content} />
          </div>
        )}

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={REPORT_LIMITS.note}
            aria-describedby="note-count"
            rows={2}
            placeholder="その他補足があれば記載してください"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <CharCounter id="note-count" value={note} max={REPORT_LIMITS.note} />
        </div>

        <div>
          <label htmlFor="reported-erratum-url" className="block text-sm font-medium text-gray-700 mb-1">
            出版社の正誤表URL（任意）
          </label>
          <p className="text-xs text-gray-500 mb-2">
            確認した正誤表のURLを登録してください。管理者が正規のURLであることを確認のうえ、書籍ページに
            公式リンクとして掲載します。
          </p>
          <input
            id="reported-erratum-url"
            type="url"
            value={reportedErratumUrl}
            onChange={(e) => setReportedErratumUrl(e.target.value)}
            maxLength={REPORT_LIMITS.reportedErratumUrl}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-1">
            画像（任意・{REPORT_IMAGE_MAX_COUNT}枚まで）
          </label>
          <p className="text-xs text-gray-500 mb-2">
            該当箇所の<strong>切り抜き</strong>を添付してください。ページ全体の撮影・スクリーンショットは
            著作権への配慮から避けてください（JPEG / PNG / WebP・1枚4MBまで）。
          </p>
          {images.length < REPORT_IMAGE_MAX_COUNT && (
            <input
              id="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 file:cursor-pointer"
            />
          )}
          {images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {images.map(({ file, previewUrl }, index) => (
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
                    onClick={() => removeImage(index)}
                    aria-label={`${file.name} を削除`}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.push(routes.home)}
          className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "投稿中..." : "投稿する"}
        </button>
      </div>
    </form>
  );
}
