"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBook, updateBook } from "@/features/book/actions/book";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";

type Book = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  publisherName: string | null;
  coverImageUrl: string | null;
  erratumUrl: string | null;
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
  // 正誤表URLは OpenBD から取れない（出版社サイトの情報）ので、上の差分取得の対象外
  const [erratumUrl, setErratumUrl] = useState(book.erratumUrl ?? "");

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
      const res = await fetch(`${routes.api.booksOpenbd}?isbn=${encodeURIComponent(book.isbn)}`);
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
    // バリデーションエラーはアクションがフィールド別メッセージをそのまま返す。
    // 成功時はアクション側の refresh() で画面が最新化される
    const result = await updateBook(book.id, { title, author, publisherName, coverImageUrl, erratumUrl });
    if (result?.error) {
      setError(result.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`「${book.title}」を削除しますか？この操作は取り消せません。`)) return;
    setSaving(true);
    setError("");
    // 成功時はアクション側が一覧へ redirect する
    const result = await deleteBook(book.id);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="book-isbn" className="block text-sm font-medium text-gray-700 mb-1">ISBN（変更不可）</label>
          <input id="book-isbn" value={book.isbn} readOnly className={`${inputClass} bg-gray-50 text-gray-500 font-mono`} />
          <p className="mt-1 text-xs text-gray-400">ISBN は本の同一性の基準のため編集できません。</p>
        </div>

        <div>
          <label htmlFor="book-title" className="block text-sm font-medium text-gray-700 mb-1">書籍名</label>
          <input id="book-title" value={title} onChange={(e) => { setTitle(e.target.value); dirtyReset(); }} className={inputClass} />
        </div>

        <div>
          <label htmlFor="book-author" className="block text-sm font-medium text-gray-700 mb-1">著者</label>
          <input id="book-author" value={author} onChange={(e) => { setAuthor(e.target.value); dirtyReset(); }} className={inputClass} />
        </div>

        <div>
          <label htmlFor="book-publisher" className="block text-sm font-medium text-gray-700 mb-1">出版社</label>
          <input id="book-publisher" value={publisherName} onChange={(e) => { setPublisherName(e.target.value); dirtyReset(); }} className={inputClass} />
          <p className="mt-1 text-xs text-gray-400">同名の出版社が無ければ新規作成されます。空にすると紐付けを外します。</p>
        </div>

        <div>
          <label htmlFor="book-cover-url" className="block text-sm font-medium text-gray-700 mb-1">書影URL</label>
          <input id="book-cover-url" value={coverImageUrl} onChange={(e) => { setCoverImageUrl(e.target.value); dirtyReset(); }} className={inputClass} />
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="書影プレビュー" className="mt-2 h-24 w-auto rounded border border-gray-200 object-contain" />
          )}
        </div>

        <div>
          <label htmlFor="book-erratum-url" className="block text-sm font-medium text-gray-700 mb-1">正誤表URL（出版社の公式ページ）</label>
          <input
            id="book-erratum-url"
            value={erratumUrl}
            onChange={(e) => { setErratumUrl(e.target.value); dirtyReset(); }}
            placeholder="https://..."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">
            書籍ページと投稿詳細に公式リンクとして表示されます。読者の申告は各投稿の管理画面から採用できます（https のみ）。
          </p>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-green-700">更新しました</p>}

        <div className="flex gap-3 justify-between pt-2">
          <div className="flex gap-3">
            <Button type="button" onClick={handleSave} disabled={saving} className="px-6">
              {saving ? "更新中..." : "更新する"}
            </Button>
            <Button
              type="button"
              onClick={() => router.push(routes.admin.books)}
              variant="secondary"
              className="px-6"
            >
              一覧に戻る
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={saving || book.reportCount > 0}
            title={book.reportCount > 0 ? "投稿が紐づく書籍は削除できません" : undefined}
            variant="dangerOutline"
          >
            削除
          </Button>
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
          <Button
            type="button"
            onClick={handleFetchOpenBd}
            disabled={fetching}
            variant="secondary"
            className="shrink-0"
          >
            {fetching ? "取得中..." : "ISBNで最新取得"}
          </Button>
        </div>

        {fetchError && <p className="text-sm text-red-700">{fetchError}</p>}

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
            <Button type="button" onClick={applyAll} variant="secondary">
              差分をすべて反映
            </Button>
            <p className="text-xs text-gray-400">
              反映してもまだ更新はされません。内容を確認して「更新する」を押してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
