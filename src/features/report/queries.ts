import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { mapReport } from "@/features/report/utils/mappers";
import { imagePool } from "@/features/report/report-images";
import type { Report } from "@/features/report/types";

/**
 * **投稿の読み取り（Data Access Layer）。** ページ（サーバーコンポーネント）が描画のために await する。
 *
 * 満たすべき条件は3つで、Next.js のガイドがそのまま挙げているもの
 * （`node_modules/next/dist/docs/01-app/02-guides/data-security.md`）:
 *   1. サーバーでしか動かない … 先頭の `import "server-only"`（クライアントから import するとビルドが落ちる）
 *   2. 認可を行う … 公開情報なのでここでは不要。閲覧者ごとに変わる判定は呼び出し側（services/publisher-access.ts）
 *   3. **安全で最小の DTO を返す** … 生の行ではなく `Report`（= types.ts）を返す。下の ⚠️ を参照
 *
 * ⚠️ **`"use server"` は付けない。** 付けると Server Action 扱いになり、
 *    クライアントから呼べるエンドポイントとして公開されてしまう。
 *
 * ⚠️ **書き込みはここではなく `actions/`。** 分ける軸は読み書きではなく**呼ばれ方**で、
 *    ページが描画時に読むならここ、クライアントが操作中に呼ぶなら Server Action になる。
 */

// ⚠️ **export しない。** この形（どの関連をどう取るか）が外に出ると、呼び出し側が
// 自前の findMany に流用でき、include の一元管理という目的が崩れる。
// 投稿を含めて引きたい画面は、この下の関数を呼ぶ。
const reportInclude = {
  book: { include: { publisher: true } },
  images: true,
  // 追記は古い順（読む順が 投稿 → 追記1 → 追記2 と時系列になる）。
  // 画像は追記に添えて足せるので一緒に引く（投稿本体の画像とは別扱い = schema.prisma）
  addenda: { orderBy: { createdAt: "asc" }, include: { images: true } },
  // 出版社からの回答も古い順（やりとりの順に読める）。出版社名は行が持つ publisherId で引く
  // ＝書籍の出版社を管理者が後から直しても、過去の回答の帰属が変わらない（schema.prisma）
  publisherComments: {
    orderBy: { createdAt: "asc" },
    include: { publisher: { select: { name: true } } },
  },
  // ⚠️ email は退会判定（匿名化済みメールか）に**このファイルの中だけ**で使う。
  // mapReport が捨てるので、戻り値の型（Report）には現れない＝ページは触れない。
  user: { select: { displayName: true, email: true } },
  _count: { select: { upvotes: true } },
} satisfies Prisma.ReportInclude;

/**
 * トップの新着フィード用。1ページ分の投稿（新着順）と総件数を返す。
 * skip/take でサーバー側ページングするので、11件目以降も ?page=N で辿れる
 * （古い投稿が導線から消えないようにするのが目的）。
 */
export async function findReportsPage(
  page: number,
  pageSize: number
): Promise<{ reports: Report[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      include: reportInclude,
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count(),
  ]);
  return { reports: rows.map(mapReport), total };
}

/**
 * /reports（検索・一覧ページ）用の全投稿（新着順）。
 * 絞り込み・並べ替え・ページ送りはクライアント側テーブル（report-table.tsx）が担うため全件返す。
 *
 * ⚠️ **投稿が 1,000 件を超えたら、ここをサーバー側のページングへ切り替える**（2026-08-06 決定）。
 *
 * 全件をブラウザへ送る代わりに、キーを打つたびの即時絞り込みが成立している＝意図した設計であって、
 * 直し忘れではない。ただし送る量は件数に比例するので天井がある。
 * 実測（合成データの JSON バイト長）: 典型的な1件 940B・全欄が上限＋画像5枚で 19KB
 * ＝ **件数だけでは重さが決まらない**（内訳で20倍ぶれる）。1,000 件は「ここで壊れる」線ではなく
 * 「ここから先は放置しないと決めた」線で、典型なら 0.9MB、実装の助走が取れるうちに動くための数字。
 *
 * 切り替えるときに一緒に済ませること:
 *   - 絞り込みは必ず DB（where）へ移す。手元に1ページ分しか無い状態で JS で絞ると
 *     「今のページの中だけ検索」という別物になる。検索語・種別・ステータスは URL へ（?q= は既にある）
 *   - この include から images を外す（一覧はカードも表も画像を出さない。bookAuthor・note も未使用）
 *   - ?page=N が付くので canonical の扱いを決める。トップと同じ「各ページに自分自身」であって、
 *     /reports に集約している今の宣言（app/(site)/reports/page.tsx）のままにはできない
 */
export async function findAllReports(): Promise<Report[]> {
  const rows = await prisma.report.findMany({
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapReport);
}

/** ID 指定で1件取得（存在しなければ null）。 */
export async function findReportById(id: string): Promise<Report | null> {
  const row = await prisma.report.findUnique({
    where: { id },
    include: reportInclude,
  });
  return row === null ? null : mapReport(row);
}

/** 特定ユーザーの投稿一覧（最新順）。 */
export async function findReportsByUser(userId: string): Promise<Report[]> {
  const rows = await prisma.report.findMany({
    where: { userId },
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapReport);
}

/**
 * 1冊（ISBN 指定）に付いた投稿の一覧（最新順）。
 *
 * ⭐ **書籍と一緒に1回で引かないのは、フィーチャーを跨がないため。** 書籍は features/book が持ち、
 * 投稿は features/report が持つ。両方を必要とする書籍ページ（app 層）が2つを呼んで組み立てる
 * ＝「またがるものは app 層で組み立てる」（README）。
 *
 * ⚠️ 書籍の UUID ではなく ISBN で受ける。呼び出し側に内部 ID を渡さずに済み、
 *    問い合わせも1回で足りる（`Book.isbn` は unique）。渡す ISBN は正規形にしておくこと。
 */
export async function findReportsByIsbn(isbn: string): Promise<Report[]> {
  const rows = await prisma.report.findMany({
    where: { book: { isbn } },
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapReport);
}

/** 閲覧者がその投稿に賛同済みか。未ログインの呼び出し側は問い合わせ自体を省く。 */
export async function hasUpvoted(reportId: string, profileId: string): Promise<boolean> {
  const upvote = await prisma.upvote.findUnique({
    where: { reportId_profileId: { reportId, profileId } },
    select: { id: true },
  });
  return upvote !== null;
}

// ────────────────────────────────────────────────────────────────────────
// 管理画面用。⚠️ **公開側の Report（DTO）と同じものを使い回さない。** 管理者に要るのは
// 対応記録（statusNote・申告された正誤表 URL）で、読者に出す整形済みの本文とは別物。
// 認可は app/admin/layout.tsx の requireAdminPage() が担う。
// ────────────────────────────────────────────────────────────────────────

/** 投稿一覧（管理）の1行。 */
export type AdminReportRow = {
  id: string;
  title: string;
  bookTitle: string;
  publisherName: string | null;
  type: Report["type"];
  status: Report["status"];
  createdAt: Date;
};

/** 投稿一覧（新着順）と総件数。 */
export async function findReportsPageForAdmin(
  page: number,
  pageSize: number
): Promise<{ reports: AdminReportRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      include: { book: { include: { publisher: { select: { name: true } } } } },
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count(),
  ]);

  return {
    reports: rows.map((report) => ({
      id: report.id,
      title: report.title,
      bookTitle: report.book.title,
      publisherName: report.book.publisher?.name ?? null,
      type: report.type,
      status: report.status,
      createdAt: report.createdAt,
    })),
    total,
  };
}

/** 1冊に付いた「申告された正誤表 URL」（採用済みかの判定は呼び出し側）。 */
export function findReportedErratumUrls(
  bookId: string
): Promise<{ id: string; reportedErratumUrl: string | null }[]> {
  return prisma.report.findMany({
    where: { bookId, reportedErratumUrl: { not: null } },
    select: { id: true, reportedErratumUrl: true },
    orderBy: { createdAt: "desc" },
  });
}

/** サイトマップ用。公開している投稿ページの ID と更新時刻だけ。 */
export function findAllReportIds(): Promise<{ id: string; updatedAt: Date }[]> {
  return prisma.report.findMany({ select: { id: true, updatedAt: true } });
}

/**
 * 投稿1件（管理）。⚠️ **日時は Date のまま返す**（管理画面は表示直前に formatJst* で整形する）。
 * 公開側の Report が整形済みなのは、そのまま client component へ渡るため。
 */
export type AdminReport = {
  id: string;
  title: string;
  type: Report["type"];
  medium: Report["medium"];
  status: Report["status"];
  statusNote: string | null;
  edition: number | null;
  printing: number | null;
  page: number | null;
  line: number | null;
  hasMultiplePages: boolean;
  locationNote: string | null;
  ebookLocation: string | null;
  wrong: string | null;
  correct: string | null;
  content: string | null;
  note: string | null;
  fixedEdition: number | null;
  fixedPrinting: number | null;
  /** 投稿者が申告した正誤表 URL（採用は管理者の操作 = features/book/actions/book.ts）。 */
  reportedErratumUrl: string | null;
  createdAt: Date;
  book: {
    title: string;
    author: string | null;
    isbn: string;
    publisherName: string | null;
    erratumUrl: string | null;
  };
  images: { id: string; imageUrl: string }[];
  publisherComments: { id: string; publisherName: string; body: string; byAdmin: boolean; createdAt: Date }[];
};

export async function findReportForAdmin(id: string): Promise<AdminReport | null> {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      book: { include: { publisher: { select: { name: true } } } },
      images: true,
      // 出版社からの回答（古い順）。ここではモデレーションの削除だけを行う
      publisherComments: {
        orderBy: { createdAt: "asc" },
        include: { publisher: { select: { name: true } } },
      },
    },
  });
  if (!report) return null;

  return {
    id: report.id,
    title: report.title,
    type: report.type,
    medium: report.medium,
    status: report.status,
    statusNote: report.statusNote,
    edition: report.edition,
    printing: report.printing,
    page: report.page,
    line: report.line,
    hasMultiplePages: report.hasMultiplePages,
    locationNote: report.locationNote,
    ebookLocation: report.ebookLocation,
    wrong: report.wrong,
    correct: report.correct,
    content: report.content,
    note: report.note,
    fixedEdition: report.fixedEdition,
    fixedPrinting: report.fixedPrinting,
    reportedErratumUrl: report.reportedErratumUrl,
    createdAt: report.createdAt,
    book: {
      title: report.book.title,
      author: report.book.author,
      isbn: report.book.isbn,
      publisherName: report.book.publisher?.name ?? null,
      erratumUrl: report.book.erratumUrl,
    },
    images: report.images.map((image) => ({ id: image.id, imageUrl: image.imageUrl })),
    publisherComments: report.publisherComments.map((comment) => ({
      id: comment.id,
      publisherName: comment.publisher.name,
      body: comment.body,
      byAdmin: comment.byAdmin,
      createdAt: comment.createdAt,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────
// 画像アップロード（Route Handler）が使う読み取り。書き込み側は report-images.ts。
// ────────────────────────────────────────────────────────────────────────

/** 投稿の持ち主（存在しなければ null）。呼び出し側が 404 と 403 を撃ち分けるため id ではなく所有者を返す。 */
export async function findReportOwnerId(reportId: string): Promise<string | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { userId: true },
  });
  return report?.userId ?? null;
}

/**
 * その追記が本当にこの投稿のものか。
 * ⚠️ 他人の投稿の追記 ID を渡されても画像が付かないようにするための確認なので、省略しないこと。
 */
export async function addendumBelongsToReport(
  addendumId: string,
  reportId: string
): Promise<boolean> {
  const addendum = await prisma.reportAddendum.findUnique({ where: { id: addendumId } });
  return addendum !== null && addendum.reportId === reportId;
}

/** いま枠に入っている枚数（速い失敗のための早期チェック用）。 */
export function countImagesInPool(reportId: string, addendumId: string | null): Promise<number> {
  return prisma.reportImage.count({ where: imagePool(addendumId).where(reportId) });
}
