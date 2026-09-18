import "server-only";
import { prisma } from "@/lib/prisma";
import type { Report } from "@/features/report/types";

/**
 * **管理画面が読む投稿。** 公開側（queries.ts）とファイルを分けてあるのは、
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
