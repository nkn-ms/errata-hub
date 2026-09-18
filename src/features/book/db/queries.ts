import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * **書籍の読み取り（Data Access Layer）。** 条件と根拠は features/report/db/queries.ts の冒頭と同じ。
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


// ────────────────────────────────────────────────────────────────────────
// 管理画面用。⚠️ **公開側と同じ DTO を使い回さない。** 管理者に出す欄（内部 ID・件数）と
// 読者に出す欄は違い、片方に足した欄がもう片方から漏れるのを防ぐため（= Next.js の data-security）。
// 認可は app/admin/layout.tsx の requireAdminPage() が担う。
// ⚠️ ページサイズは引数で受ける。定数が app/admin/pagination.tsx にあり、
//    features は app を import できない（import/no-restricted-paths）。
// ────────────────────────────────────────────────────────────────────────

/** 書籍マスタ一覧の1行。 */
export type AdminBookRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  publisherName: string | null;
  reportCount: number;
};

/** 書籍マスタ一覧（新着順）と総件数。 */
export async function findBooksPageForAdmin(
  page: number,
  pageSize: number
): Promise<{ books: AdminBookRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.book.findMany({
      include: { publisher: { select: { name: true } }, _count: { select: { reports: true } } },
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.book.count(),
  ]);

  return {
    books: rows.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      publisherName: book.publisher?.name ?? null,
      reportCount: book._count.reports,
    })),
    total,
  };
}

/** 書籍の編集画面用（内部 ID 指定）。 */
export type AdminBook = AdminBookRow & { coverImageUrl: string | null; erratumUrl: string | null };

export async function findBookForAdmin(id: string): Promise<AdminBook | null> {
  const book = await prisma.book.findUnique({
    where: { id },
    include: { publisher: { select: { name: true } }, _count: { select: { reports: true } } },
  });
  if (!book) return null;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publisherName: book.publisher?.name ?? null,
    reportCount: book._count.reports,
    coverImageUrl: book.coverImageUrl,
    erratumUrl: book.erratumUrl,
  };
}

/** サイトマップ用。公開している書籍ページの ISBN と更新時刻だけ。 */
export function findAllBookIsbns(): Promise<{ isbn: string; updatedAt: Date }[]> {
  return prisma.book.findMany({ select: { isbn: true, updatedAt: true } });
}
