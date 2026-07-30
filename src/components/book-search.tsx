"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import Image from "next/image";
import { routes } from "@/constants/routes";

type BookResult = {
  googleBooksId: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

// Google Books API レスポンスのうち利用する部分のみ
type GoogleBooksItem = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    publisher?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string };
  };
};

type Props = {
  onSelect: (book: BookResult) => void;
};

type Mode = "api" | "isbn";

// Google Books の書影 URL は http で返ることがある。https のページから http 画像は
// 混在コンテンツとしてブラウザにブロックされるため、https に揃える（books.google.com は https 対応）。
function toHttpsUrl(url: string | undefined): string {
  return url?.replace("http://", "https://") ?? "";
}

// OpenBD に書影が無いとき用に、Google Books から ISBN 一致の書影だけ取得する。
// 失敗しても書影が無いだけなので空文字を返してプレースホルダーにフォールバック。
async function fetchGoogleCover(isbn: string): Promise<string> {
  if (!isbn) return "";
  try {
    const res = await fetch(`${routes.api.booksSearch}?type=isbn&q=${encodeURIComponent(isbn)}`);
    if (!res.ok) return "";
    const data = await res.json();
    return toHttpsUrl(data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail);
  } catch {
    return "";
  }
}

// OpenBD レスポンス summary のうち利用する部分
type OpenBdSummary = {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
};

// タイトル検索(Google)の結果を、得られた ISBN で OpenBD を一括照会して書誌情報を補正する。
// 和書は Google だと書名がローマ字化・出版社が欠落しがちなため、書誌(title/author/publisher)は
// OpenBD を正とする。書影は OpenBD がほぼ持たないため Google のものを維持する。
// OpenBD は ISBN をカンマ区切りで 1 リクエストにまとめられる（順序保持・無ければ null）。
async function enrichWithOpenBD(books: BookResult[]): Promise<BookResult[]> {
  const isbns = books.map((b) => b.isbn).filter(Boolean);
  if (isbns.length === 0) return books;
  try {
    const res = await fetch(`${routes.api.booksOpenbd}?isbn=${isbns.join(",")}`);
    if (!res.ok) return books;
    const data: ({ summary?: OpenBdSummary } | null)[] = await res.json();
    const byIsbn = new Map<string, OpenBdSummary>();
    for (const entry of data) {
      const s = entry?.summary;
      if (s?.isbn) byIsbn.set(s.isbn, s);
    }
    return books.map((b) => {
      const s = byIsbn.get(b.isbn);
      if (!s) return b; // OpenBD に無ければ Google のまま
      return {
        ...b,
        title: s.title || b.title,
        author: s.author || b.author,
        publisher: s.publisher || b.publisher,
        // 書影は OpenBD がほぼ返さないため Google の書影を維持
      };
    });
  } catch {
    return books; // 失敗時は Google のまま（検索を止めない）
  }
}

export function BookSearch({ onSelect }: Props) {
  const [mode, setMode] = useState<Mode>("isbn");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BookResult | null>(null);
  const [isbnQuery, setIsbnQuery] = useState("");
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnError, setIsbnError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setSelected(null);
    setOpen(false);
    setIsbnError("");
  }

  async function handleIsbnSearch() {
    const isbn = isbnQuery.trim().replace(/-/g, "");
    if (!isbn) return;
    setIsbnLoading(true);
    setIsbnError("");
    setSelected(null);
    try {
      const res = await fetch(`${routes.api.booksOpenbd}?isbn=${isbn}`);
      const data = await res.json();
      if (!data?.[0]) {
        setIsbnError("該当する書籍が見つかりませんでした。ISBNをご確認ください。");
        return;
      }
      const summary = data[0].summary;
      const book: BookResult = {
        googleBooksId: "",
        title: summary.title ?? "",
        author: summary.author ?? "",
        publisher: summary.publisher ?? "",
        isbn: summary.isbn ?? isbn,
        coverImageUrl: summary.cover ?? "",
      };
      // OpenBD は出版社未登録だと書影が空。メタデータは OpenBD（日本語が正確）を
      // 使いつつ、書影だけ Google Books（ISBN 一致）で補完する。
      if (!book.coverImageUrl) {
        book.coverImageUrl = await fetchGoogleCover(book.isbn);
      }
      setSelected(book);
      onSelect(book);
    } catch {
      setIsbnError("検索中にエラーが発生しました。");
    } finally {
      setIsbnLoading(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    setSelected(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${routes.api.booksSearch}?q=${encodeURIComponent(value)}`
        );
        const data = await res.json();
        const items: GoogleBooksItem[] = data.items ?? [];
        const books: BookResult[] = items
          .map((item) => {
            const info = item.volumeInfo;
            const isbn =
              info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
              info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
              "";
            return {
              googleBooksId: item.id,
              title: info.title ?? "",
              author: (info.authors ?? []).join(", "),
              publisher: info.publisher ?? "",
              isbn,
              coverImageUrl: toHttpsUrl(info.imageLinks?.thumbnail),
            };
          })
          // ISBN を本の同一性の基準にするため、ISBN の無い結果は選択させない
          .filter((b) => b.isbn);
        // 書誌情報は OpenBD を正として補正（書影は Google を維持）
        const enriched = await enrichWithOpenBD(books);
        setResults(enriched);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(book: BookResult) {
    setSelected(book);
    setQuery(book.title);
    setOpen(false);
    onSelect(book);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* モード切替 */}
      <div className="flex gap-3 text-xs">
        {(["isbn", "api"] as Mode[]).map((m) => {
          const labels = { isbn: "ISBNで検索（推奨）", api: "タイトルで検索" };
          return (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`underline ${mode === m ? "text-blue-600 font-medium" : "text-gray-400"}`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      {mode === "api" && (
        <>
          <div className="relative">
            <input
              // 投稿フォームのエラーサマリー（「書籍を選択してください」）から飛ばす先。
              // ⚠️ 下の ISBN 検索の入力欄と同じ id を意図的に共有している。mode で排他的に
              //    描画されるので同時に存在せず、どちらのモードでも同じ id で指せる
              //    （選択済みのときは report-form 側の「別の本を選ぶ」がこの id を持つ）。
              id="book-search"
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="書籍名・著者名で検索..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {open && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {loading && <div className="px-4 py-3 text-sm text-gray-400">検索中...</div>}
              {!loading && results.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400">
                  見つかりません。ISBNがわかる場合は
                  <button type="button" onClick={() => switchMode("isbn")} className="text-blue-600 underline mx-1">ISBNで検索</button>
                  をお試しください。
                </div>
              )}
              {!loading && results.map((book) => (
                <button
                  key={book.googleBooksId}
                  type="button"
                  onClick={() => handleSelect(book)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  {book.coverImageUrl ? (
                    <Image src={book.coverImageUrl} alt="" width={32} height={44} unoptimized className="w-8 h-11 object-cover flex-shrink-0 rounded" />
                  ) : (
                    <div className="w-8 h-11 bg-gray-200 flex-shrink-0 rounded" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 line-clamp-1">{book.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{book.author}</div>
                    <div className="text-xs text-gray-400">{book.publisher}</div>
                  </div>
                </button>
              ))}
                </div>
          )}

          <p className="text-xs text-gray-400">
            目的の本が見つからない場合は
            <button type="button" onClick={() => switchMode("isbn")} className="text-blue-600 underline mx-1">ISBNで検索</button>
            をお試しください。
          </p>

          {selected && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              {selected.coverImageUrl ? (
                <Image src={selected.coverImageUrl} alt="" width={48} height={64} unoptimized className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{selected.title}</div>
                <div className="text-xs text-gray-600 mt-0.5">{selected.author}</div>
                <div className="text-xs text-gray-500">{selected.publisher}</div>
                {selected.isbn && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    ISBN: <span className="font-mono">{selected.isbn}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "isbn" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">ISBNは書籍の裏表紙や奥付に記載されています（13桁または10桁）。ISBNがわかる場合はこちらの方が正確なデータを取得できます。</p>
          <div className="flex gap-2">
            <input
              // 上のタイトル検索の入力欄と同じ id（mode で排他的に描画される。理由はそちらのコメント）
              id="book-search"
              type="text"
              value={isbnQuery}
              onChange={(e) => setIsbnQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIsbnSearch()}
              placeholder="例: 9784873116860"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleIsbnSearch}
              disabled={isbnLoading || !isbnQuery.trim()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {isbnLoading ? "検索中..." : "検索"}
            </button>
          </div>
          {isbnError && (
            <p className="text-xs text-red-700">
              {isbnError}
            </p>
          )}
          {selected && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              {selected.coverImageUrl ? (
                <Image src={selected.coverImageUrl} alt="" width={48} height={64} unoptimized className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{selected.title}</div>
                <div className="text-xs text-gray-600 mt-0.5">{selected.author}</div>
                <div className="text-xs text-gray-500">{selected.publisher}</div>
                {selected.isbn && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    ISBN: <span className="font-mono">{selected.isbn}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
