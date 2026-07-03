"use client";

import { useState } from "react";
import { BookSearch } from "@/components/book-search";
import { useRouter } from "next/navigation";
import { routes } from "@/constants/routes";
import { TYPE_LABELS, MEDIUM_LABELS } from "@/constants/report-labels";

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

export function ReportForm() {
  const router = useRouter();
  const [book, setBook] = useState<BookData | null>(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isErrataType = reportType === "ERRATA";
  const isPaper = medium === "PAPER";

  async function handleSubmit(e: React.FormEvent) {
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
      const res = await fetch(routes.api.reports, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 選択中の媒体・種別に関係ない欄は null で送る（切替前の入力残りを送信しない）
        body: JSON.stringify({
          book,
          edition: isPaper && edition ? parseInt(edition) : null,
          printing: isPaper && printing ? parseInt(printing) : null,
          title,
          type: reportType,
          medium,
          page: isPaper && page ? parseInt(page) : null,
          line: isPaper && line ? parseInt(line) : null,
          hasMultiplePages: isPaper && hasMultiplePages,
          locationNote: medium === "EBOOK" ? null : locationNote || null,
          ebookLocation: medium === "EBOOK" ? ebookLocation : null,
          wrong: isErrataType ? wrong : null,
          correct: isErrataType ? correct : null,
          content: isErrataType ? null : content,
          note: note || null,
        }),
      });

      if (!res.ok) throw new Error("投稿に失敗しました");
      router.push(routes.home);
    } catch {
      setError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 書籍情報 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">書籍情報</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            書籍名 <span className="text-red-500">*</span>
          </label>
          <BookSearch onSelect={setBook} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">読んだ媒体</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              placeholder="例: 1"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">刷（任意）</label>
            <input
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: p.42「わたし」→「私」の誤植"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">種別</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ページ番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder="例: 42"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">行番号（任意）</label>
                <input
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
              <label className="block text-sm font-medium text-gray-700 mb-1">位置備考（任意）</label>
              <input
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder={hasMultiplePages ? "例: 42〜44、または 42, 43, 44" : "例: ページ中央の図、p.102にも同様の誤りあり"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {medium === "EBOOK" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              位置 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ebookLocation}
              onChange={(e) => setEbookLocation(e.target.value)}
              placeholder="例: 位置No.1234、43%、p.42"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {medium === "OTHER" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              位置メモ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              placeholder="例: 第3章「◯◯」の節、サンプルコードzip内のreadme"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 誤→正 or 内容 */}
        {isErrataType ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                誤（該当箇所） <span className="text-red-500">*</span>
              </label>
              <textarea
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                rows={2}
                placeholder="誤りのある文章をそのまま入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                正（正しい内容） <span className="text-red-500">*</span>
              </label>
              <textarea
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                rows={2}
                placeholder="正しいと思われる内容を入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              内容・提案 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="気になる点や改善提案を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="その他補足があれば記載してください"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
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
