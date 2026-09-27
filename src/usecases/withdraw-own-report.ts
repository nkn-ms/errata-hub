"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import type { ReportActionState } from "@/features/report/types";
import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";
import { findReportForDeletion, removeImageFiles } from "@/features/report/db/report-deletion";

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
      const found = await findReportForDeletion(tx, id);
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
