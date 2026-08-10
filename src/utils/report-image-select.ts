import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_MB,
  REPORT_IMAGE_MAX_SOURCE_BYTES,
  REPORT_IMAGE_MAX_SOURCE_MB,
} from "@/constants/report-images";
import { compressImage } from "@/utils/image-compress";

/**
 * 選ばれたファイルを添付できる形に整える（形式・枚数・サイズの検査＋圧縮。ブラウザ専用）。
 *
 * 投稿フォームと投稿詳細（投稿者による後からの追加）の2か所で使う。**同じ制約を2度書かない**ため
 * にここへ出した: 上限も文言も利用者に見えるので、片方だけ直すと同じ操作が画面によって
 * 違う結果になる。サーバー側の最終検査は api/reports/[id]/images。
 */
export type SelectedImages = {
  /** 添付してよいと判断できたファイル（圧縮後） */
  accepted: File[];
  /** 弾いた理由。複数あっても最後の1件だけを見せる（画面には1行しか出さない） */
  error: string;
};

export async function selectReportImages(files: File[], remaining: number): Promise<SelectedImages> {
  const accepted: File[] = [];
  let error = "";

  for (const file of files) {
    if (accepted.length >= remaining) {
      error = `画像は${REPORT_IMAGE_MAX_COUNT}枚までです`;
      break;
    }
    if (!REPORT_IMAGE_ALLOWED_TYPES[file.type]) {
      error = "画像は JPEG / PNG / WebP のみ添付できます";
      continue;
    }
    // 上限の検査は「圧縮前」と「圧縮後」の2段。前者はデコードでブラウザが固まるのを防ぐ枠で、
    // 後者が本来の上限。スマホの写真は素で 3〜4MB 出るので、圧縮前に 4MB で弾くと
    // 「縮めれば通るはずの写真」を投稿できなくなる（圧縮を入れる前はそうなっていた）。
    if (file.size > REPORT_IMAGE_MAX_SOURCE_BYTES) {
      error = `画像は1枚${REPORT_IMAGE_MAX_SOURCE_MB}MB以下にしてください`;
      continue;
    }
    const compressed = await compressImage(file);
    if (compressed.size > REPORT_IMAGE_MAX_BYTES) {
      error = `縮小しても${REPORT_IMAGE_MAX_MB}MBを超えるため添付できません`;
      continue;
    }
    accepted.push(compressed);
  }

  return { accepted, error };
}
