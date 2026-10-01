"use server";

import { toCanonicalIsbn } from "@/utils/isbn";
import { findErratumUrlByIsbn } from "@/features/book/db/books";

/**
 * ISBN からその本の公式な正誤表 URL を引く（投稿フォームで書籍を選んだ直後に使う）。
 *
 * 読み取りだが Server Action にしている理由: これは「ページ表示」ではなく
 * 対話的な参照（ユーザーが書籍を選んだ瞬間に呼ぶ）で、ページ遷移を伴わないため。
 * HTTP 境界が必要な事情も無い（design.md §7 のデータアクセス境界）。
 * 公開情報なので認可は不要。
 */
export async function findErratumUrlByIsbnAction(isbn: string): Promise<{ erratumUrl: string | null }> {
  const canonicalIsbn = toCanonicalIsbn(isbn);
  if (!canonicalIsbn) return { erratumUrl: null };

  return { erratumUrl: await findErratumUrlByIsbn(canonicalIsbn) };
}
