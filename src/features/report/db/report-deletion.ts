import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_IMAGE_BUCKET } from "@/features/report/constants/report-images";
import { storagePathFromPublicUrl } from "@/features/report/utils/report-images";

// 投稿を消す操作（投稿者の取り下げ・管理者の削除・画像1枚・追記1件）が共有する処理。

// 削除対象の読み出し。監査ログの before に使う値なので、削除と同じトランザクションの中で読む
// （読んでから消すまでの間に他の変更が入り込まないようにする）。
// ⚠️ 追記と出版社の回答も Cascade で一緒に消えるので、本文ごと読んで before に残す
//    （1件ずつ消すときの deleteReportAddendumUsecase / deletePublisherCommentUsecase と揃える）。
//    画像は投稿本体の分も追記の分も images に入っている（どちらの行も reportId を持つ）。
export function findReportForDeletion(client: Prisma.TransactionClient, id: string) {
  return client.report.findUnique({
    where: { id },
    include: {
      images: true,
      addenda: { orderBy: { createdAt: "asc" } },
      publisherComments: {
        orderBy: { createdAt: "asc" },
        // 出版社は名前も残す（90日で消える AuditLog から後で引き直せないため = deletePublisherCommentUsecase）
        include: { publisher: { select: { name: true } } },
      },
    },
  });
}

/**
 * Storage 上のファイルを消す。**必ずコミット後に呼ぶ**（取り消せない操作なので DB の確定を待つ）。
 *
 * Storage は外部サービスでトランザクションに入れられない＝原子性は諦め、「どちらに倒すか」を
 * 決めている: DB を先に消す＝**ファイルだけ残る（孤児）**。逆（ファイルを先に消す）だと
 * 画像が壊れて表示されるので、利用者に見える分だけ実害が大きい。
 *
 * 残った孤児を後から辿る手段は **`AuditLog` の `before`**（呼び出し元が消した画像の `imageUrl` を
 * そこに残している）。⚠️ `console.error` は手段にならない — Vercel Hobby の Runtime Logs は
 * 保持1時間で、気づかなければ消える（出典: https://vercel.com/docs/logs/runtime の Limits）。
 * 監査ログは DB にあり90日残るので、この記録だけが実用的な手掛かりになる。
 */
export async function removeImageFiles(imageUrls: string[]) {
  const paths = imageUrls
    .map((imageUrl) => storagePathFromPublicUrl(imageUrl))
    .filter((path): path is string => path !== null);
  if (paths.length === 0) return;

  const storageAdmin = createAdminClient();
  const { error } = await storageAdmin.storage.from(REPORT_IMAGE_BUCKET).remove(paths);
  if (error) {
    // DB 側は確定済みなのでエラーにはしない。孤児ファイルの手掛かりとして記録のみ。
    console.error("画像ファイルの削除に失敗:", paths, error);
  }
}
