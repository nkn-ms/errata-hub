"use client";

import { useState } from "react";
import { BookSearch } from "@/components/book-search";
import { useRouter } from "next/navigation";
import { routes } from "@/constants/routes";

type BookData = {
  googleBooksId: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

type ReportType = "TYPO" | "ERRATA" | "READABILITY" | "OTHER";
type LocationType = "PAGE" | "KINDLE" | "OTHER";

const typeLabels: Record<ReportType, string> = {
  TYPO: "誤字脱字",
  ERRATA: "正誤情報",
  READABILITY: "読みにくい・わかりにくい",
  OTHER: "その他",
};

export function ReportForm() {
  const router = useRouter();
  const [book, setBook] = useState<BookData | null>(null);
  const [edition, setEdition] = useState("");
  const [printing, setPrinting] = useState("");
  const [reportType, setReportType] = useState<ReportType>("TYPO");
  const [locationType, setLocationType] = useState<LocationType>("PAGE");
  const [page, setPage] = useState("");
  const [line, setLine] = useState("");
  const [hasMultiplePages, setHasMultiplePages] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [kindleLocation, setKindleLocation] = useState("");
  const [title, setTitle] = useState("");
  const [wrong, setWrong] = useState("");
  const [correct, setCorrect] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isErrataType = reportType === "TYPO" || reportType === "ERRATA";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!book) { setError("書籍を選択してください"); return; }
    if (!book.isbn) { setError("ISBNのある書籍を選択してください"); return; }
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (locationType === "PAGE" && !page) { setError("ページ番号を入力してください"); return; }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(routes.api.reports, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book,
          edition: edition ? parseInt(edition) : null,
          printing: printing ? parseInt(printing) : null,
          title,
          type: reportType,
          locationType,
          page: page ? parseInt(page) : null,
          line: line ? parseInt(line) : null,
          hasMultiplePages,
          locationNote: locationNote || null,
          kindleLocation: kindleLocation || null,
          wrong: wrong || null,
          correct: correct || null,
          content: content || null,
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

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">版</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">刷</label>
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
      </section>

      {/* フィードバック内容 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">フィードバック内容</h2>

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
            {(Object.keys(typeLabels) as ReportType[]).map((t) => (
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
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 位置情報 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">位置情報の種別</label>
          <div className="flex gap-2">
            {(["PAGE", "KINDLE", "OTHER"] as LocationType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLocationType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  locationType === t
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                }`}
              >
                {t === "PAGE" ? "ページ" : t === "KINDLE" ? "Kindle" : "その他"}
              </button>
            ))}
          </div>
        </div>

        {locationType === "PAGE" && (
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

        {locationType === "KINDLE" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kindle位置 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={kindleLocation}
              onChange={(e) => setKindleLocation(e.target.value)}
              placeholder="例: 43% または Location 1234"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {locationType === "OTHER" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">位置メモ</label>
            <input
              type="text"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              placeholder="場所を自由に記載してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 誤→正 or 内容 */}
        {isErrataType ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">誤（該当箇所）</label>
              <textarea
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                rows={2}
                placeholder="誤りのある文章をそのまま入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">正（正しい内容）</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">内容・提案</label>
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
