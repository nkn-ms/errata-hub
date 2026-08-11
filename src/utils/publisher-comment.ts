import type { PublisherCommentView } from "@/types/report";

/**
 * 一覧（フィードのカード・/reports の表）に出す1件＝**最新の回答**。
 *
 * 末尾が最新なのは、引くときに古い順で並べているため（services/report.ts の reportInclude）。
 * 一覧はやりとりの現在地だけを見せ、全件は投稿詳細で読む。
 */
export function latestPublisherComment(
  comments: PublisherCommentView[]
): PublisherCommentView | undefined {
  return comments.at(-1);
}

/**
 * 一覧の1行に付ける短いラベル。代理記載であることはここでも落とさない
 * （規約 第8条4項の明示義務。本文は行末で切られうるので、印はラベル側に置く）。
 */
export function publisherCommentLabel(comment: PublisherCommentView): string {
  return comment.byAdmin ? "出版社（代理記載）" : "出版社";
}
