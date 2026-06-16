import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * 投稿のクエリを集約するサービス層。
 *
 * 一覧・詳細で共通して使う include 形（書籍・出版社・画像・投稿者名）をここで一元管理し、
 * 各ページ（サーバーコンポーネント）はこの関数を直接 await して使う。
 * HTTP 越しの自前 API は挟まない（同一プロセスなら関数呼び出しの方が速くクリーン）。
 */
export const reportInclude = {
  book: { include: { publisher: true } },
  images: true,
  user: { select: { displayName: true } },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

/** 最新順の投稿一覧。take で件数を絞れる（トップページは最新 N 件）。 */
export function findRecentReports(take?: number) {
  return prisma.report.findMany({
    include: reportInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** ID 指定で1件取得（存在しなければ null）。 */
export function findReportById(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: reportInclude,
  });
}

/** 特定ユーザーの投稿一覧（最新順）。 */
export function findReportsByUser(userId: string) {
  return prisma.report.findMany({
    where: { userId },
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
}
