"use server";

import { runInTransaction } from "@/services/transaction";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import type { ReportActionState } from "@/features/report/types";
import {
  deleteReportImage,
  findReportImageForDeletion,
  removeImageFiles,
} from "@/features/report/db/report-deletion";

type OwnImageDeletion =
  | { error: string; imageUrl?: undefined }
  | { error?: undefined; imageUrl: string };

/**
 * 添付画像を1枚だけ削除する（投稿者本人・出版社へ連絡する前だけ）。
 *
 * 削除を PENDING に限るのは、本文を凍結しても画像を消せるなら**出版社が見た内容は結局変わる**ため。
 * 連絡後に足す画像は追記に添える（本体の枠には入れない = schema.prisma の ReportImage.addendumId）。
 *
 * ⚠️ 管理者用の deleteReportImageAction とは別に置く。あちらは権利者からの削除要請に応える措置で、
 *    ステータスに関わらず消せる必要があり、条件を共有すると両方の意図が濁る。
 */
export async function deleteOwnReportImageAction(imageId: string): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  let result: OwnImageDeletion;
  try {
    result = await runInTransaction(async (tx): Promise<OwnImageDeletion> => {
      // 認可もステータスの確認もトランザクションの中で行う（updateOwnReportAction と同じ理由。詳細ページを開いて
      // いる間に管理者が連絡済みにする競合があり、画面を出した時点の判定では防げない）
      const found = await findReportImageForDeletion(imageId, tx);
      if (!found) return { error: "画像が見つかりません" };
      if (found.report.userId !== user.id) {
        return { error: "この画像を削除する権限がありません" };
      }
      if (found.report.status !== "PENDING") {
        return { error: "連絡済みの投稿は画像を削除できません。" };
      }

      await deleteReportImage(imageId, tx);
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

  // ⚠️ refresh() しない。呼び出し側（features/report/components/report-edit-form.tsx）は追加も削除も自分の state で持っており、
  //    サーバーを描き直しても初期値としては読まれない＝往復が増えるだけになる。
  return {};
}
