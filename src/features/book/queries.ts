import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * **書籍の読み取り（Data Access Layer）。** 条件と根拠は features/report/queries.ts の冒頭と同じ。
 *
 * ⚠️ **投稿は返さない。** 書籍と投稿は別のフィーチャーなので、両方を必要とする画面（書籍ページ）が
 *    app 層で2つを呼んで組み立てる = README「またがるものは app 層で組み立てる」。
 *    ただし**件数だけは返す** — `Book.reports` は Book が持つリレーションで、
 *    数えるのに features/report のコードは要らない（メタデータと OG 画像がこれだけを使う）。
 */

/** 書籍の表示用（DTO）。Book の UUID は URL に使わないのでクライアントへ出さない。 */
export type BookView = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  coverImageUrl: string;
  erratumUrl: string | null;
  reportCount: number;
};

/**
 * ISBN 指定で1冊（存在しなければ null）。
 *
 * ⚠️ **渡す ISBN は呼び出し側で正規形にしておくこと。** DB は ISBN-13 で保存していて、
 *    ここでは正規化しない。理由は、見つからなかったときの倒し方が画面ごとに違うため
 *    （書籍ページは 404、メタデータと OG 画像は既定の文言で描画を続ける）。
 *    正規化そのものは utils/isbn.ts の toCanonicalIsbn に1本化されている。
 */
export async function findBookByIsbn(isbn: string): Promise<BookView | null> {
  const book = await prisma.book.findUnique({
    where: { isbn },
    include: { publisher: true, _count: { select: { reports: true } } },
  });
  if (!book) return null;

  return {
    isbn: book.isbn,
    title: book.title,
    author: book.author ?? "",
    publisher: book.publisher?.name ?? "",
    coverImageUrl: book.coverImageUrl ?? "",
    erratumUrl: book.erratumUrl,
    reportCount: book._count.reports,
  };
}

