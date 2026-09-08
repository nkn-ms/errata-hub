import Image from "next/image";
import { BookMarked } from "lucide-react";

type Props = {
  /** 書影のURL。無い本は空文字・null で来る（マッパーが揃えている） */
  src: string | null | undefined;
  alt: string;
  /** 元画像の寸法。プレースホルダのときは箱の縦横比としてそのまま使う */
  width: number;
  height: number;
  /** 幅と配置のクラス（例: "w-24 shrink-0"）。高さは width/height の比から決まる */
  className?: string;
};

// 書籍の表紙。**書影が無い本は珍しくない**（外部の書誌データに元から存在しない。
// 自前で用意する方針も採っていない = docs の書影ポリシー）ので、無いときは
// 「表紙なし」と分かるプレースホルダを出す。要素ごと省くと空白になり、
// 読み込み中や画像切れのように見えてしまう。
//
// 書影は外部API由来でホストが可変のため unoptimized（remotePatterns 未登録のホストで落ちない）。
//
// ⚠️ **self-start を外すと書影が壊れる。** 呼び出し元はどちらも横並び（flex）の中に置いており、
//    flex の既定の align-items: stretch は「高さが auto の項目」を行の高さまで引き伸ばす。
//    ここは h-auto なので、隣の書誌テキストが伸びるほど書影の箱が縦に伸び、
//    object-cover が原寸の比率を捨てて左右を切り落とす
//    （実測: 64x90 のはずが PC 幅で 64x120・スマホ幅で 64x166）。
//    e2e の「書影の箱は隣の書誌より背が低くても引き伸ばされない」（smoke.spec.ts）が
//    この高さを測っている。
//
// ※ 新着フィード（report-card.tsx）は行の高さを揃えるため書影を固定寸法で切り抜いており、
//    ここ（原寸の比率のまま出す）とは別の見せ方なので共通化していない。
export function BookCover({ src, alt, width, height, className = "" }: Props) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={`h-auto self-start rounded object-cover shadow-sm ${className}`}
      />
    );
  }

  return (
    // 表紙が無いことは隣の書名から分かるので、装飾として読み上げから外す
    <div
      aria-hidden
      style={{ aspectRatio: `${width} / ${height}` }}
      className={`flex items-center justify-center self-start rounded border border-gray-200 bg-gray-50 ${className}`}
    >
      <BookMarked className="w-1/3 h-auto text-gray-300" />
    </div>
  );
}
