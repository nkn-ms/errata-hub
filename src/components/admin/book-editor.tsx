"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/constants/routes";

type Book = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  publisherName: string | null;
  coverImageUrl: string | null;
  reportCount: number;
};

// OpenBD レスポンス summary のうち利用する部分（book-search.tsx と同じ並び）
type OpenBdSummary = {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  cover?: string;
};

// 編集対象フィールドの内部キー → 表示ラベル
const FIELD_LABELS = {
  title: "書籍名",
  author: "著者",
  publisherName: "出版社",
  coverImageUrl: "書影URL",
} as const;
type FieldKey = keyof typeof FIELD_LABELS;

export function AdminBookEditor({ book }: { book: Book }) {
  const router = useRouter();

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [publisherName, setPublisherName] = useState(book.publisherName ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(book.coverImageUrl ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // OpenBD 取得結果（取得前は null）
  const [fetched, setFetched] = useState<Record<FieldKey, string> | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const setters: Record<FieldKey, (v: string) => void> = {
    title: setTitle,
    author: setAuthor,
    publisherName: setPublisherName,
    coverImageUrl: setCoverImageUrl,
  };
  const current: Record<FieldKey, string> = {
    title,
    author,
    publisherName,
    coverImageUrl,
  };

  function dirtyReset() {
    setSaved(false);
    setError("");
  }

  async function handleFetchOpenBd() {
    setFetching(true);
    setFetchError("");
    setFetched(null);
    try {
      const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(book.isbn)}`);
      if (!res.ok) throw new Error();
      const data: ({ summary?: OpenBdSummary } | null)[] = await res.json();
      const s = data[0]?.summary;
      if (!s) {
        setFetchError("OpenBD にこの ISBN の書誌が見つかりませんでした。");
        return;
      }
      setFetched({
        title: s.title ?? "",
        author: s.author ?? "",
        publisherName: s.publisher ?? "",
        coverImageUrl: s.cover ?? "",
      });
    } catch {
      setFetchError("OpenBD の取得に失敗しました。時間をおいて再試行してください。");
    } finally {
      setFetching(false);
    }
  }

  function applyField(key: FieldKey) {
    if (!fetched) return;
    setters[key](fetched[key]);
    dirtyReset();
  }

  function applyAll() {
    if (!fetched) return;
    (Object.keys(FIELD_LABELS) as FieldKey[]).forEach((key) => {
      // 取得値が空のフィールドは上書きしない（既存値を消さない）
      if (fetched[key]) setters[key](fetched[key]);
    });
    dirtyReset();
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(routes.api.book(book.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, publisherName, coverImageUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "保存に失敗しました");
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`「${book.title}」を削除しますか？この操作は取り消せません。`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(routes.api.book(book.id), { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "削除に失敗しました");
      }
      router.push(routes.admin.books);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ISBN（変更不可）</label>
          <input value={book.isbn} readOnly className={`${inputClass} bg-gray-50 text-gray-500 font-mono`} />
          <p className="mt-1 text-xs text-gray-400">ISBN は本の同一性の基準のため編集できません。</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">書籍名</label>
          <input value={title} onChange={(e) => { setTitle(e.target.value); dirtyReset(); }} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">著者</label>
          <input value={author} onChange={(e) => { setAuthor(e.target.value); dirtyReset(); }} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">出版社</label>
          <input value={publisherName} onChange={(e) => { setPublisherName(e.target.value); dirtyReset(); }} className={inputClass} />
          <p className="mt-1 text-xs text-gray-400">同名の出版社が無ければ新規作成されます。空にすると紐付けを外します。</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">書影URL</label>
          <input value={coverImageUrl} onChange={(e) => { setCoverImageUrl(e.target.value); dirtyReset(); }} className={inputClass} />
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="書影プレビュー" className="mt-2 h-24 w-auto rounded border border-gray-200 object-contain" />
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-600">保存しました</p>}

        <div className="flex gap-3 justify-between pt-2">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
            <button
              type="button"
              onClick={() => router.push(routes.admin.books)}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              一覧に戻る
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || book.reportCount > 0}
            title={book.reportCount > 0 ? "投稿が紐づく書籍は削除できません" : undefined}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            削除
          </button>
        </div>
        {book.reportCount > 0 && (
          <p className="text-xs text-gray-400">
            {book.reportCount} 件の投稿が紐づいているため削除できません。
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">OpenBD で書誌を確認</h2>
            <p className="mt-1 text-xs text-gray-500">
              この ISBN の最新の書誌を OpenBD から取得し、現在の値と差分を比較できます。
            </p>
          </div>
          <button
            type="button"
            onClick={handleFetchOpenBd}
            disabled={fetching}
            className="shrink-0 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {fetching ? "取得中..." : "ISBNで最新取得"}
          </button>
        </div>

        {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

        {fetched && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">項目</th>
                    <th className="px-3 py-2 font-medium">現在の値</th>
                    <th className="px-3 py-2 font-medium">OpenBD</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => {
                    const cur = current[key];
                    const next = fetched[key];
                    const differs = cur.trim() !== next.trim();
                    return (
                      <tr key={key} className={differs ? "bg-amber-50" : ""}>
                        <td className="px-3 py-2 text-gray-700 align-top whitespace-nowrap">{FIELD_LABELS[key]}</td>
                        <td className="px-3 py-2 text-gray-500 align-top break-all">{cur || <span className="text-gray-300">（未設定）</span>}</td>
                        <td className={`px-3 py-2 align-top break-all ${differs ? "font-medium text-amber-800" : "text-gray-500"}`}>
                          {next || <span className="text-gray-300">（なし）</span>}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {differs && next && (
                            <button
                              type="button"
                              onClick={() => applyField(key)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                            >
                              反映
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={applyAll}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              差分をすべて反映
            </button>
            <p className="text-xs text-gray-400">
              反映してもまだ保存はされません。内容を確認して「保存する」を押してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
