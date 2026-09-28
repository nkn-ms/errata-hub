"use server";

import { prisma } from "@/lib/prisma";
import { toCanonicalIsbn } from "@/utils/isbn";

/**
 * ISBN からその本の公式な正誤表 URL を引く（投稿フォームで書籍を選んだ直後に使う）。
 *
 * 読み取りだが Server Action にしている理由: これは「ページ表示」ではなく
 * 対話的な参照（ユーザーが書籍を選んだ瞬間に呼ぶ）で、ページ遷移を伴わないため。
 * HTTP 境界が必要な事情も無い（design.md §7 のデータアクセス境界）。
 * 公開情報なので認可は不要。
 */
export async function findErratumUrlByIsbnUsecase(isbn: string): Promise<{ erratumUrl: string | null }> {
  const canonicalIsbn = toCanonicalIsbn(isbn);
  if (!canonicalIsbn) return { erratumUrl: null };

  const book = await prisma.book.findUnique({
    where: { isbn: canonicalIsbn },
    select: { erratumUrl: true },
  });
  return { erratumUrl: book?.erratumUrl ?? null };
}
