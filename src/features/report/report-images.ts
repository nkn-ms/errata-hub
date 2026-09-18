import "server-only";
import { prisma } from "@/lib/prisma";
import { ADDENDUM_IMAGE_MAX_COUNT, REPORT_IMAGE_MAX_COUNT } from "@/features/report/constants/report-images";

/**
 * **添付画像の書き込み。Server Action ではない**ので `actions/` には置かない
 * （呼ぶのは Route Handler = app/api/reports/[id]/images。画像だけ Route Handler なのは
 * Server Actions のボディ上限 4.5MB に収めるため = README）。
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
      }
    : {
        limit: ADDENDUM_IMAGE_MAX_COUNT,
        where: (reportId: string) => ({ reportId, addendumId: { not: null } }),
        message: `追記に添付できる画像は1件の投稿につき${ADDENDUM_IMAGE_MAX_COUNT}枚までです`,
      };
}

/** 競合で枠が埋まっていたことを表す番兵。トランザクションを確実にロールバックさせるために投げる。 */
class ImageLimitReached extends Error {}

export type CreateImageResult =
  | { ok: true; image: { id: string; imageUrl: string } }
  | { ok: false; reason: "limit" };

/**
 * 枚数上限を最終判定してから画像行を作る。
 *
 * 呼び出し側の早期チェックは速い失敗のためのもので、並列送信では**チェックと作成の間**
 * （＝時間のかかる Storage アップロードの間）に別リクエストが割り込める（TOCTOU）。
 * 親 Report 行を FOR UPDATE でロックして同一投稿への並列アップロードを直列化し、
 * 確定した枚数で判定してから作成する。別投稿どうしは id が違うので競合しない。
 *
 * ⚠️ **上限超過を例外ではなく結果で返す。** 呼び出し側は失敗時に Storage の実体を消す必要があり、
 *    「想定内の失敗」と「想定外の例外」を撃ち分けられないと掃除の判断ができない。
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
      await tx.$queryRaw`SELECT 1 FROM "Report" WHERE id = ${params.reportId} FOR UPDATE`;
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
    throw e;
  }
}
