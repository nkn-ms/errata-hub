"use client";

import { useRef, useState } from "react";

// 選択中（送信前）の画像のサムネイル。押すと拡大表示が開く。投稿・編集・追記の3つのフォームが同じ形で使う。
// 圧縮で紙面の文字が読めなくなっていないかを、送る前に自分で確かめられるようにするためのもの
// （サムネイルが小さいままだと劣化に気づけない）。
//
// 投稿済みの画像はここを使わず、リンクで新しいタブに開く（単独のページの方がピンチで拡大しやすい）。
// 送信前の画像は blob: URL で、新しいタブに開いても使い物にならないので拡大表示にしている。
type Props = {
  /** blob: URL。ローカルのプレビューなので next/image は使わない */
  src: string;
  /** ファイル名。読み上げで「どの画像を拡大するのか」を示すのにも使う */
  alt: string;
  /** サムネイルの img に付ける（背景色がフォームごとに違う） */
  className?: string;
};

export function ImageZoomPreview({ src, alt, className }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 中身は開いている間だけ描画する。閉じた <dialog> の中の img も DOM には残るので、
  // 常に置くと同じ alt の画像がサムネイルと2枚になる
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* button にしてキーボードでも開ける */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className="block w-full cursor-zoom-in"
        aria-label={`${alt} を拡大`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>

      {/* 画像を押しても、外側の暗い部分を押しても閉じる。
          ⚠️ 外側（::backdrop）を押したときのクリックは中の button ではなく dialog 自身に届く
          （target === currentTarget）ので、dialog 側でも拾う。button だけだと画像の上しか効かず、
          ESC の無いスマホでは閉じる手段がブラウザの「戻る」しか残らない。
          <dialog> を使うのは ESC とフォーカス管理がネイティブで付いてくるため。どの閉じ方でも onClose を通る */}
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        {open && (
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="block cursor-zoom-out"
            aria-label="拡大表示を閉じる"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90dvh] max-w-[90vw] rounded-lg bg-white object-contain"
            />
          </button>
        )}
      </dialog>
    </>
  );
}
