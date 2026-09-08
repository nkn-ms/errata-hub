import { encodeWebp } from "@/features/report/utils/image-compress";

/**
 * 送る前の添付画像（選択済み・未アップロード）の扱い。投稿フォーム・編集フォーム・追記の3か所で共用する。
 *
 * 回転を付けたのは、横向きに構えて撮った写真が横倒しのまま載ることがあるため。
 * 向きは撮影時の EXIF に入っているが、**元から入っていない（あるいは既に落ちている）画像は
 * ブラウザにも直しようがない**ので、最後は人が回すしかない。
 */
export type SelectedImage = {
  /**
   * 選択した時点のファイル（圧縮済み）。**回転はいつもここから1回だけ掛ける。**
   * 直前の結果を回し続けると、押した回数だけ webp の再エンコードが重なって画質が落ちる
   * （紙面の文字が読めることが添付の目的なので、劣化の蓄積は機能そのものを損なう）。
   */
  base: File;
  /** base からの回転量（時計回りの90度単位・0〜3） */
  rotation: QuarterTurns;
  /** 実際に送るファイル。rotation が 0 なら base と同じ実体 */
  file: File;
  /** 表示用の object URL。file と対で作り替え、捨てるときに revoke する */
  previewUrl: string;
};

export type QuarterTurns = 0 | 1 | 2 | 3;

export function toSelectedImage(file: File): SelectedImage {
  return { base: file, rotation: 0, file, previewUrl: URL.createObjectURL(file) };
}

/**
 * 時計回りに90度回した項目を返す（4回で元に戻る）。失敗したら null を返し、
 * 呼び出し側が「回転できなかった」と知らせる（黙って何も起きないと押し間違いと区別が付かない）。
 *
 * 成功したときは古い previewUrl をここで revoke する。返り値に差し替えれば漏れない。
 */
export async function rotateSelectedImage(image: SelectedImage): Promise<SelectedImage | null> {
  const rotation = ((image.rotation + 1) % 4) as QuarterTurns;
  const rotated = rotation === 0 ? image.base : await rotateImage(image.base, rotation);
  if (!rotated) return null;

  URL.revokeObjectURL(image.previewUrl);
  return {
    base: image.base,
    rotation,
    file: rotated,
    previewUrl: URL.createObjectURL(rotated),
  };
}

/** 表示をやめる項目の object URL を解放する（削除・送信後の後片付け） */
export function revokeSelectedImage(image: SelectedImage): void {
  URL.revokeObjectURL(image.previewUrl);
}

/**
 * 画像を時計回りに90度単位で回して webp に焼き直す（ブラウザ専用）。
 *
 * 回転を CSS ではなく画素に焼くのは、送った先で向きが元に戻らないようにするため
 * （表示だけ回しても、保存されるのは横倒しのファイルのままになる）。
 * 拡大・縮小はしない（寸法は選択時の圧縮で既に決まっている）。
 */
async function rotateImage(file: File, turns: QuarterTurns): Promise<File | null> {
  try {
    // imageOrientation は圧縮と同じ指定。EXIF を持つ画像（圧縮を通らなかった小さい写真）を
    // 回すときに、表示されている向きと焼き上がりの向きを一致させる
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    // 90度・270度は縦横が入れ替わる
    const swapped = turns % 2 === 1;
    const canvas = document.createElement("canvas");
    canvas.width = swapped ? bitmap.height : bitmap.width;
    canvas.height = swapped ? bitmap.width : bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    // canvas の中心を軸に回してから、画像の中心を原点に合わせて描く
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((turns * Math.PI) / 2);
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    bitmap.close();

    return await encodeWebp(canvas, file.name);
  } catch {
    return null;
  }
}
