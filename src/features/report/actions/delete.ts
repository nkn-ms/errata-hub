"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import type { ReportActionState } from "@/features/report/types";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Prisma } from "@/generated/prisma/client";
import { REPORT_IMAGE_BUCKET } from "@/features/report/constants/report-images";
import { storagePathFromPublicUrl } from "@/features/report/utils/report-images";
import { routes } from "@/constants/routes";

type OwnReportWithdrawal =
  | { error: string; imageUrls?: undefined }
  | { error?: undefined; imageUrls: string[] };

/**
 * 投稿を取り下げる（投稿者本人・出版社へ連絡する前だけ）。
 *
 * 動機は「**誤った正誤情報は、無いことより有害**」。指摘そのものが丸ごと誤りだったとき、
 * これが無いと投稿者は管理者が `DISMISSED` にするのを待つしかない。
 *
 * ⭐ **投稿ごと削除する**（「取り下げ済み」として残さない）。`ReportStatus` は出版社対応の進捗を
 * 表す1軸で、可視性の状態を混ぜない方針のため = [[decision-report-status-6values]] / docs/design.md §7。
 * 連絡前に限るので、消しても出版社の対応が宙に浮くことはない。
 *
 * ⚠️ 賛同（`Upvote`）と追記は Cascade で一緒に消える。他人が付けた賛同まで消えるのは事実だが、
 *    PENDING の間しか取り下げられない＝外へ出る前なので、影響の範囲は投稿者本人の中に留まる。
 *    消えたこと自体は AuditLog の before に投稿の中身ごと残る（管理者の deleteReport と同じ）。
 */
export async function withdrawOwnReport(id: string): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  let result: OwnReportWithdrawal;
  try {
    // 認可もステータスの確認も塊の中で行う（updateOwnReport と同じ理由。画面を開いている間に
    // 管理者が連絡済みにする競合があり、画面を出した時点の判定では防げない）
    result = await prisma.$transaction(async (tx): Promise<OwnReportWithdrawal> => {
      const found = await findReportWithImages(tx, id);
      if (!found) return { error: "投稿が見つかりません" };
      if (found.userId !== user.id) {
        return { error: "この投稿を取り下げる権限がありません" };
      }
      if (found.status !== "PENDING") {
        return { error: "連絡済みの投稿は取り下げられません。追記でご対応ください。" };
      }

      await tx.report.delete({ where: { id } });
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.WITHDRAW_OWN_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return { imageUrls: found.images.map((image) => image.imageUrl) };
    });
  } catch (error) {
    console.error(error);
    return { error: "取り下げに失敗しました" };
  }

  if (result.error !== undefined) return result;

  await removeImageFiles(result.imageUrls);

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）。
  // 投稿は消えたので元のページには戻れない。自分の投稿一覧＝残っているものが見える場所へ送る
  redirect(routes.user(user.id));
}

// 削除対象の読み出し。監査ログの before に使う値なので、削除と同じ塊の中で読む
// （読んでから消すまでの間に他の変更が入り込まないようにする）。
function findReportWithImages(client: Prisma.TransactionClient, id: string) {
  return client.report.findUnique({ where: { id }, include: { images: true } });
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
async function removeImageFiles(imageUrls: string[]) {
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

export async function deleteReport(id: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let report: Awaited<ReturnType<typeof findReportWithImages>>;
  try {
    // 塊にする理由は「操作は成立したのに記録だけが無い」状態を作らないため。
    // 分けると「投稿は消えたが記録が無い」半端な状態が残り、しかも監査ログの失敗で
    // catch に入るため画面には「削除に失敗しました」と出る（実際は消えている）。
    // 塊にすれば、記録が残せないときは削除ごと巻き戻るので、その文言が事実になる。
    // （投稿と監査ログが同じ DB にあることは、この手段を使える条件であって理由ではない。
    //   外部サービスをまたぐ操作は包めないので、別途「どちらに倒すか」を決める＝下の Storage）
    //
    // ⚠️ 塊の中では tx を使うこと。グローバルの prisma を使うと別接続になり塊の外に出る。
    report = await prisma.$transaction(async (tx) => {
      const found = await findReportWithImages(tx, id);
      if (!found) return null;

      await tx.report.delete({ where: { id } });
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }

  if (!report) {
    return { error: "投稿が見つかりません" };
  }

  await removeImageFiles(report.images.map((image) => image.imageUrl));

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.reports);
}

/**
 * 添付画像を1枚だけ削除する（管理者のみ）。
 *
 * 動機は権利者対応の実効性。「この画像だけ消してほしい」と言われたとき、これが無いと
 * 投稿ごと消すか Supabase の管理画面で行とファイルを手作業で消すしかない
 * （docs/moderation-policy.md の「部分マスキング」と同じ系統の措置）。
 *
 * 投稿本文には触れない＝**投稿を消さずに済ませる**ための手段であることが要点。
 */
export async function deleteReportImage(imageId: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let image: Awaited<ReturnType<typeof prisma.reportImage.findUnique>>;
  try {
    // deleteReport と同じ形: 行の削除と監査ログを1つの塊にする。
    // ⚠️ 権利者からの削除要請に応じた証跡なので、**記録が残せないなら削除も成立させない**方が正しい。
    // 「記録だけが無い」状態を作らないことが目的で、同じ DB であることは条件にすぎない。
    image = await prisma.$transaction(async (tx) => {
      const found = await tx.reportImage.findUnique({ where: { id: imageId } });
      if (!found) return null;

      await tx.reportImage.delete({ where: { id: imageId } });
      // 対象は投稿（画像は投稿の一部）なので targetId は reportId にし、消した画像を before に残す。
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT_IMAGE,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "画像の削除に失敗しました" };
  }

  if (!image) {
    return { error: "画像が見つかりません" };
  }

  await removeImageFiles([image.imageUrl]);

  refresh();
  return {};
}

type OwnImageDeletion =
  | { error: string; imageUrl?: undefined }
  | { error?: undefined; imageUrl: string };

/**
 * 添付画像を1枚だけ削除する（投稿者本人・出版社へ連絡する前だけ）。
 *
 * 削除を PENDING に限るのは、本文を凍結しても画像を消せるなら**出版社が見た内容は結局変わる**ため。
 * 追加の方は追記と同じ「足すだけ」の操作なので、連絡後も開いている（api/reports/[id]/images）。
 *
 * ⚠️ 管理者用の deleteReportImage とは別に置く。あちらは権利者からの削除要請に応える措置で、
 *    ステータスに関わらず消せる必要があり、条件を共有すると両方の意図が濁る。
 */
export async function deleteOwnReportImage(imageId: string): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  let result: OwnImageDeletion;
  try {
    result = await prisma.$transaction(async (tx): Promise<OwnImageDeletion> => {
      // 認可もステータスの確認も塊の中で行う（updateOwnReport と同じ理由。詳細ページを開いて
      // いる間に管理者が連絡済みにする競合があり、画面を出した時点の判定では防げない）
      const found = await tx.reportImage.findUnique({
        where: { id: imageId },
        include: { report: { select: { userId: true, status: true } } },
      });
      if (!found) return { error: "画像が見つかりません" };
      if (found.report.userId !== user.id) {
        return { error: "この画像を削除する権限がありません" };
      }
      if (found.report.status !== "PENDING") {
        return { error: "連絡済みの投稿は画像を削除できません。" };
      }

      await tx.reportImage.delete({ where: { id: imageId } });
      // 消せる期間でも記録は残す。上書きと同じで、消した後は画像があったことを辿る手段が
      // これしかない（賛同が付いた後に根拠だけ消える形を検知できるようにしておく）。
      // 対象は投稿（画像は投稿の一部）なので targetId は reportId にする。
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.DELETE_OWN_REPORT_IMAGE,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: { id: found.id, imageUrl: found.imageUrl },
        },
        tx
      );
      return { imageUrl: found.imageUrl };
    });
  } catch (error) {
    console.error(error);
    return { error: "画像の削除に失敗しました" };
  }

  if (result.error !== undefined) return { error: result.error };

  await removeImageFiles([result.imageUrl]);

  // ⚠️ refresh() しない。呼び出し側（report-images.tsx）は追加も削除も自分の state で持っており、
  //    サーバーを描き直しても初期値としては読まれない＝往復が増えるだけになる。
  return {};
}
