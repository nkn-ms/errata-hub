import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { sanitizeExternalUrl } from "@/utils/external-url";

/**
 * **書籍の読み書き（Data Access Layer）。** 条件と根拠は features/report/db/reports.ts の冒頭と同じ。
 *
 * ⚠️ **投稿は返さない。** 書籍と投稿は別のフィーチャーなので、両方を必要とする画面（書籍ページ）が
 *    app 層で2つを呼んで組み立てる = README「組み合わせるのは、サーバー側なら usecases、画面側なら app」。
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


// ────────────────────────────────────────────────────────────────────────
// 操作（usecases）が呼ぶもの。認可は呼び出し側の usecase が済ませている
// （理由は features/report/db/reports.ts の冒頭）。戻り値は画面に出さない（id と、監査ログに残す行）。
// ────────────────────────────────────────────────────────────────────────

/** ISBN で書籍の id を引く（無ければ null）。渡す ISBN は正規形にしておくこと（ここでも正規化しない＝findBookByIsbn と同じ）。 */
export async function findBookIdByIsbn(isbn: string): Promise<string | null> {
  const book = await prisma.book.findUnique({ where: { isbn }, select: { id: true } });
  return book?.id ?? null;
}

/**
 * ISBN で書籍を用意し、id を返す（無ければ作る）。
 *
 * ⚠️ **既にあれば何も変えない**（書誌を直すのは管理者の書籍編集＝下の updateBook）。
 *    呼び出し側が findBookIdByIsbn で「無い」と確かめた後でも、同じ ISBN の同時投稿が先に
 *    作っていることがある。ISBN を同一性の基準として upsert で名寄せする（@unique 制約により競合にも安全）。
 */
export async function ensureBook(book: {
  isbn: string;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  publisherId: string | null;
}): Promise<string> {
  const { id } = await prisma.book.upsert({
    where: { isbn: book.isbn },
    update: {},
    create: book,
  });
  return id;
}

/** 1冊を、監査ログにそのまま残す形（出版社の行を含む）で引く（無ければ null）。 */
export function findBookForAuditLog(id: string, client: Prisma.TransactionClient = prisma) {
  return client.book.findUnique({ where: { id }, include: { publisher: true } });
}

/**
 * 管理者による書誌の手修正を保存し、保存後の行を監査ログに残す形（出版社の行を含む）で返す。
 *
 * 空の欄は「未設定」として null で保存する。書影と正誤表の URL は呼び出し側で検査済みの値を受け、
 * ここでは保存する形（整えた URL か null）にするだけ。
 */
export function updateBook(
  id: string,
  book: {
    title: string;
    author?: string;
    coverImageUrl?: string;
    erratumUrl?: string;
    publisherId: string | null;
  },
  client: Prisma.TransactionClient = prisma
) {
  return client.book.update({
    where: { id },
    data: {
      title: book.title,
      author: book.author || null,
      coverImageUrl: sanitizeCoverImageUrl(book.coverImageUrl),
      erratumUrl: sanitizeExternalUrl(book.erratumUrl),
      publisherId: book.publisherId,
    },
    include: { publisher: true },
  });
}

/** 正誤表の URL だけを差し替え、保存後の行を返す。URL は呼び出し側で整えた値を受ける。 */
export function updateBookErratumUrl(
  id: string,
  erratumUrl: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.book.update({ where: { id }, data: { erratumUrl } });
}
