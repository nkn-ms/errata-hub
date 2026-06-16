import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * フィードバックのクエリを集約するサービス層。
 *
 * 一覧・詳細で共通して使う include 形（書籍・出版社・画像・投稿者名）をここで一元管理し、
 * 各ページ（サーバーコンポーネント）はこの関数を直接 await して使う。
 * HTTP 越しの自前 API は挟まない（同一プロセスなら関数呼び出しの方が速くクリーン）。
 */
export const feedbackInclude = {
  book: { include: { publisher: true } },
  images: true,
  user: { select: { displayName: true } },
} satisfies Prisma.FeedbackInclude;

export type FeedbackWithRelations = Prisma.FeedbackGetPayload<{
  include: typeof feedbackInclude;
}>;

/** 最新順のフィードバック一覧。take で件数を絞れる（トップページは最新 N 件）。 */
export function findRecentFeedbacks(take?: number) {
  return prisma.feedback.findMany({
    include: feedbackInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** ID 指定で1件取得（存在しなければ null）。 */
export function findFeedbackById(id: string) {
  return prisma.feedback.findUnique({
    where: { id },
    include: feedbackInclude,
  });
}

/** 特定ユーザーの投稿一覧（最新順）。 */
export function findFeedbacksByUser(userId: string) {
  return prisma.feedback.findMany({
    where: { userId },
    include: feedbackInclude,
    orderBy: { createdAt: "desc" },
  });
}
