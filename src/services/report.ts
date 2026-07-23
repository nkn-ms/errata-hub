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
  // email は退会判定（匿名化メールか）にのみ使い、クライアントへは渡さない（mapReport で破棄）。
  user: { select: { displayName: true, email: true } },
  _count: { select: { upvotes: true } },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

/**
 * トップの新着フィード用。1ページ分の投稿（新着順）と総件数を返す。
 * skip/take でサーバー側ページングするので、11件目以降も ?page=N で辿れる
 * （古い投稿が導線から消えないようにするのが目的）。
 */
export async function findReportsPage(page: number, pageSize: number) {
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      include: reportInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count(),
  ]);
  return { reports, total };
}

/**
 * /reports（検索・一覧ページ）用の全投稿（新着順）。
 * 絞り込み・並べ替え・ページ送りはクライアント側テーブル（report-table.tsx）が担うため全件返す。
 */
export function findAllReports() {
  return prisma.report.findMany({
    include: reportInclude,
    orderBy: { createdAt: "desc" },
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
