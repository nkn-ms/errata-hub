import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_IMAGE_BUCKET } from "@/features/report/constants/report-images";
import { storagePathFromPublicUrl } from "@/features/report/utils/report-images";

// 投稿と、その一部（画像・追記・出版社の回答）を消す操作が使う処理
// （投稿者の取り下げ・管理者の削除・画像1枚・追記1件・回答1件）。
// 認可とステータスの確認は呼び出し側の Server Action が行う（理由は reports.ts の冒頭）。

// 削除対象の読み出し。監査ログの before に使う値なので、削除と同じトランザクションの中で読む。
// ⚠️ ただし読んでから消すまでの間の他の変更は防げない（Postgres の既定の READ COMMITTED では、
//    SELECT は行をロックしない）。その間に足された画像は before に載らず、Storage に辿れないファイルが
//    残りうる。起きるにはアップロードと削除がほぼ同時に重なる必要があるので、行ロック（FOR UPDATE）は入れていない。
// ⚠️ 追記と出版社の回答も Cascade で一緒に消えるので、本文ごと読んで before に残す
//    （1件ずつ消すときの deleteReportAddendumAction / deletePublisherCommentAction と揃える）。
//    画像は投稿本体の分も追記の分も images に入っている（どちらの行も reportId を持つ）。
export function findReportForDeletion(id: string, client: Prisma.TransactionClient = prisma) {
  return client.report.findUnique({
    where: { id },
    include: {
      images: true,
      addenda: { orderBy: { createdAt: "asc" } },
      publisherComments: {
        orderBy: { createdAt: "asc" },
        // 出版社は名前も残す（90日で消える AuditLog から後で引き直せないため = deletePublisherCommentAction）
        include: { publisher: { select: { name: true } } },
      },
    },
  });
}

/** 投稿を消す。画像・賛同・追記・出版社の回答の行は Cascade で一緒に消える（Storage のファイルは消えない＝下の removeImageFiles）。 */
export async function deleteReport(id: string, client: Prisma.TransactionClient = prisma): Promise<void> {
  await client.report.delete({ where: { id } });
}

/** 画像1枚を、持ち主とステータスの確認に要る投稿の欄つきで引く（無ければ null）。監査ログの before にも使う。 */
export function findReportImageForDeletion(imageId: string, client: Prisma.TransactionClient = prisma) {
  return client.reportImage.findUnique({
    where: { id: imageId },
    include: { report: { select: { userId: true, status: true } } },
  });
}

/** 画像1枚の行を消す（Storage のファイルは下の removeImageFiles で、コミット後に消す）。 */
export async function deleteReportImage(imageId: string, client: Prisma.TransactionClient = prisma): Promise<void> {
  await client.reportImage.delete({ where: { id: imageId } });
}

/**
 * 追記1件を、添えた画像つきで引く（無ければ null）。
 * ⚠️ 画像の行は addendumId の Cascade で消えるがファイルは残るので、消す前に URL を読んでおく。
 */
export function findReportAddendumForDeletion(addendumId: string, client: Prisma.TransactionClient = prisma) {
  return client.reportAddendum.findUnique({
    where: { id: addendumId },
    include: { images: true },
  });
}

/** 追記1件を消す（添えた画像の行も Cascade で消える）。 */
export async function deleteReportAddendum(addendumId: string, client: Prisma.TransactionClient = prisma): Promise<void> {
  await client.reportAddendum.delete({ where: { id: addendumId } });
}

/** 出版社の回答1件を、出版社名つきで引く（無ければ null）。監査ログに名前で残すため。 */
export function findPublisherCommentForDeletion(commentId: string, client: Prisma.TransactionClient = prisma) {
  return client.publisherComment.findUnique({
    where: { id: commentId },
    include: { publisher: { select: { name: true } } },
  });
}

/** 出版社の回答1件を消す。 */
export async function deletePublisherComment(commentId: string, client: Prisma.TransactionClient = prisma): Promise<void> {
  await client.publisherComment.delete({ where: { id: commentId } });
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
