import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReportStatus } from "@/generated/prisma/client";
import { ADDENDUM_IMAGE_MAX_COUNT, REPORT_IMAGE_MAX_COUNT } from "@/features/report/constants/report-images";

/**
 * **添付画像の読み書き。Server Action ではない**ので `usecases/` には置かない
 * （呼ぶのは Route Handler = app/api/reports/[id]/images。画像だけ Route Handler なのは
 * Server Actions のボディ上限（既定 1MB）を超えるため = README）。
 *
 * ⚠️ **`"use server"` を付けない。** 付けるとクライアントから直接呼べる口になる。
 */

/**
 * どちらの枠で数えるかを1か所で決める（本体＝ addendumId が null の行 / 追記＝ null でない行）。
 * 早期チェックとトランザクション内の最終判定で**同じ条件**を使うためにまとめてある。
 */
export function imagePool(addendumId: string | null) {
  return addendumId === null
    ? {
        limit: REPORT_IMAGE_MAX_COUNT,
        where: (reportId: string) => ({ reportId, addendumId: null }),
        message: `画像は${REPORT_IMAGE_MAX_COUNT}枚までです`,
        // 本体の枠に足せるのは出版社へ連絡する前（PENDING）だけ。連絡後に足す画像は追記に添える
        // ＝出版社が見た時点の証拠に後から混ぜない（schema.prisma の ReportImage.addendumId）
        isOpen: (status: ReportStatus) => status === "PENDING",
      }
    : {
        limit: ADDENDUM_IMAGE_MAX_COUNT,
        where: (reportId: string) => ({ reportId, addendumId: { not: null } }),
        message: `追記に添付できる画像は1件の投稿につき${ADDENDUM_IMAGE_MAX_COUNT}枚までです`,
        // 追記は連絡後にしか作れない（addReportAddendumUsecase）ので、ここでステータスを絞る必要が無い
        isOpen: () => true,
      };
}

/** 本体の枠が閉じている（連絡済みの投稿の本体に足そうとした）ときの文言。 */
export const IMAGE_POOL_CLOSED_MESSAGE =
  "出版社へ連絡済みの投稿には、追記を書いて画像を添えてください";

/**
 * 投稿の持ち主とステータス（存在しなければ null）。呼び出し側が 404 と 403 を撃ち分け、
 * 本体の枠が閉じているかを本文を読む前に判定するため、この2つを返す。
 */
export function findReportForImageUpload(
  reportId: string
): Promise<{ userId: string; status: ReportStatus } | null> {
  return prisma.report.findUnique({
    where: { id: reportId },
    select: { userId: true, status: true },
  });
}

/**
 * その追記が本当にこの投稿のものか。
 * ⚠️ 他人の投稿の追記 ID を渡されても画像が付かないようにするための確認なので、省略しないこと。
 */
export async function addendumBelongsToReport(
  addendumId: string,
  reportId: string
): Promise<boolean> {
  const addendum = await prisma.reportAddendum.findUnique({ where: { id: addendumId } });
  return addendum !== null && addendum.reportId === reportId;
}

/** いま枠に入っている枚数（速い失敗のための早期チェック用）。 */
export function countImagesInPool(reportId: string, addendumId: string | null): Promise<number> {
  return prisma.reportImage.count({ where: imagePool(addendumId).where(reportId) });
}

/** 競合で枠が埋まっていたことを表す番兵。トランザクションを確実にロールバックさせるために投げる。 */
class ImageLimitReached extends Error {}

/** アップロードの間に連絡済みになり、本体の枠が閉じていたことを表す番兵。 */
class ImagePoolClosed extends Error {}

export type CreateImageResult =
  | { ok: true; image: { id: string; imageUrl: string } }
  | { ok: false; reason: "limit" | "closed" };

/**
 * 枚数上限を最終判定してから画像行を作る。
 *
 * 呼び出し側の早期チェックは速い失敗のためのもので、並列送信では**チェックと作成の間**
 * （＝時間のかかる Storage アップロードの間）に別リクエストが割り込める（TOCTOU）。
 * 親 Report 行を FOR UPDATE でロックして同一投稿への並列アップロードを直列化し、
 * 確定した枚数で判定してから作成する。別投稿どうしは id が違うので競合しない。
 * ステータスも同じ文で読み、本体の枠が閉じていないかをロックを取った時点の値で確かめる
 * （Storage に上げている間に管理者が連絡済みにする競合がある）。
 *
 * ⚠️ **上限超過・枠が閉じていたことを例外ではなく結果で返す。** 呼び出し側は失敗時に Storage の実体を
 *    消す必要があり、「想定内の失敗」と「想定外の例外」を撃ち分けられないと掃除の判断ができない。
 */
export async function createReportImageWithinLimit(params: {
  reportId: string;
  addendumId: string | null;
  imageUrl: string;
}): Promise<CreateImageResult> {
  const pool = imagePool(params.addendumId);

  try {
    const image = await prisma.$transaction(async (tx) => {
      // 生 SQL のテーブル名は @@map なしの既定（モデル名）に一致する
      const locked = await tx.$queryRaw<{ status: ReportStatus }[]>`
        SELECT status FROM "Report" WHERE id = ${params.reportId} FOR UPDATE
      `;
      // 行が無い（その間に投稿が消えた）ときは判定せず、下の作成が外部キー違反で失敗する
      const status = locked[0]?.status;
      if (status !== undefined && !pool.isOpen(status)) {
        throw new ImagePoolClosed();
      }
      const count = await tx.reportImage.count({ where: pool.where(params.reportId) });
      if (count >= pool.limit) {
        throw new ImageLimitReached();
      }
      return tx.reportImage.create({
        data: {
          reportId: params.reportId,
          addendumId: params.addendumId,
          imageUrl: params.imageUrl,
        },
      });
    });

    return { ok: true, image: { id: image.id, imageUrl: image.imageUrl } };
  } catch (e) {
    if (e instanceof ImageLimitReached) return { ok: false, reason: "limit" };
    if (e instanceof ImagePoolClosed) return { ok: false, reason: "closed" };
    throw e;
  }
}
