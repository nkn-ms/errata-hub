import "server-only";
import { prisma } from "@/lib/prisma";
import type { Report } from "@/features/report/types";
import { latestDate } from "@/utils/latest-date";

/**
 * **管理画面が読む投稿。** 公開側（reports.ts）とファイルを分けてあるのは、
 * ⭐ **DTO を混ぜないことがこのアプリの安全境界だから**。管理者に要るのは対応記録
 * （statusNote・申告された正誤表 URL）で、読者に出す整形済みの本文とは別物。
 * 片方に足した欄がもう片方から漏れるのを防ぐ（実際、管理画面が Prisma の行を丸ごと
 * client component へ渡していた = #292 で修正）。
 *
 * 認可は app/admin/layout.tsx の requireAdminPage() が担う。
 */

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

/** サイトマップ用の投稿1件。 */
export type SitemapReport = {
  id: string;
  isbn: string;
  /** 投稿ページを検索エンジンに載せるか。却下した投稿は載せない（理由は app/(site)/reports/[id]/page.tsx の generateMetadata） */
  indexable: boolean;
  /** 投稿の行の更新時刻（本文の編集・ステータスの変更で動く）。書籍ページの一覧に出る範囲はこれで変わる */
  updatedAt: Date;
  /** 投稿ページの中身が最後に変わった時刻（行の更新・最新の追記・最新の出版社の回答の一番新しいもの） */
  pageUpdatedAt: Date;
};

/**
 * サイトマップ用。全投稿の ID・書籍の ISBN・更新時刻。
 *
 * ⚠️ **`Report.updatedAt` だけでは投稿ページの更新時刻にならない。** 追記と出版社の回答は別のテーブルに
 *    入るので、付いても投稿の行は変わらない（＝いちばん大事な「回答が付いた」がサイトマップに出ない）。
 * ⚠️ 却下した投稿も返す。投稿ページは載せないが、書籍ページは却下した投稿も並べるので、
 *    書籍ページの更新時刻には効く（載せるかは indexable で呼び出し側が決める）。
 */
export async function findReportsForSitemap(): Promise<SitemapReport[]> {
  const rows = await prisma.report.findMany({
    select: {
      id: true,
      status: true,
      updatedAt: true,
      book: { select: { isbn: true } },
      addenda: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      publisherComments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    isbn: row.book.isbn,
    indexable: row.status !== "DISMISSED",
    updatedAt: row.updatedAt,
    pageUpdatedAt: latestDate(
      row.updatedAt,
      row.addenda[0]?.createdAt,
      row.publisherComments[0]?.createdAt
    ),
  }));
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
  /** 投稿に紐づく画像すべて。⚠️ **追記に添えた画像もここに入る**（同じ reportId を持つため）＝
   * 本体の証拠画像と見分けるのが `addendumId`（null なら投稿本体のもの）。 */
  images: { id: string; imageUrl: string; addendumId: string | null }[];
  addenda: {
    id: string;
    body: string;
    createdAt: Date;
    images: { id: string; imageUrl: string }[];
  }[];
  publisherComments: { id: string; publisherName: string; body: string; byAdmin: boolean; createdAt: Date }[];
};

export async function findReportForAdmin(id: string): Promise<AdminReport | null> {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      book: { include: { publisher: { select: { name: true } } } },
      images: true,
      // 追記も出す。管理画面に出ていないと、権利侵害の申し立てが追記の本文に来たときに
      // 投稿ごと消すしかなくなる（無関係な投稿者の投稿まで巻き込む）
      addenda: { orderBy: { createdAt: "asc" }, include: { images: true } },
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
    images: report.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      addendumId: image.addendumId,
    })),
    addenda: report.addenda.map((addendum) => ({
      id: addendum.id,
      body: addendum.body,
      createdAt: addendum.createdAt,
      images: addendum.images.map((image) => ({ id: image.id, imageUrl: image.imageUrl })),
    })),
    publisherComments: report.publisherComments.map((comment) => ({
      id: comment.id,
      publisherName: comment.publisher.name,
      body: comment.body,
      byAdmin: comment.byAdmin,
      createdAt: comment.createdAt,
    })),
  };
}
