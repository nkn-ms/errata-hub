import { REPORT_IMAGE_MAX_EDGE, REPORT_IMAGE_QUALITY, REPORT_IMAGE_SKIP_BYTES } from "@/features/report/constants/report-images";

/**
 * 添付画像をアップロード前に縮める（ブラウザ専用）。
 *
 * サーバーで縮めない理由: Vercel Hobby で効く枠は Active CPU なので、関数内の画像処理は
 * そこを直接食う。クライアントでやれば CPU は利用者の端末・帯域も節約でき、Storage も減る。
 *
 * **best-effort**。デコードや再エンコードに失敗したら元のファイルをそのまま返す。
 * 上限（REPORT_IMAGE_MAX_BYTES）の検査は呼び出し側とサーバーに残っているので、
 * ここで失敗しても安全側に倒れる。
 */
export async function compressImage(file: File): Promise<File> {
  // 既に小さいものは触らない（劣化させない・デコードの時間も使わない）。
  // 寸法ではなくサイズだけで判定するのは、寸法を知るにはデコードが要るため。
  // 1MB 以下なら大きな寸法でも Storage 上は問題にならない。
  if (file.size <= REPORT_IMAGE_SKIP_BYTES) return file;

  try {
    // imageOrientation: EXIF の回転を反映させる。付けないと iOS で撮った写真が横倒しになる。
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, REPORT_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // webp に寄せる。スクリーンショットの PNG が容量の主因で、webp なら文字の多い画像でも
    // PNG より小さくなり透過も保てる（許可 MIME に webp は既に入っている）。
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", REPORT_IMAGE_QUALITY)
    );

    // 縮まなかったなら元のまま使う（既に webp の小さい画像を再エンコードして太らせない）
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toWebpName(file.name), { type: "image/webp" });
  } catch {
    return file;
  }
}

/** 拡張子だけ webp に差し替える（保存時の拡張子は MIME から決まるので表示上の整合のため） */
function toWebpName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.webp`;
}
