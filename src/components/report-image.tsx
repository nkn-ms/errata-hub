import Image from "next/image";
import type { ReportImageView } from "@/types/report";

// 本体の証拠画像は大きく、追記に添えた画像は小さく出す（後から足したものを主役にしない
// = report-addenda.tsx の並びの意図に合わせる）。墓標も同じ寸法にして位置がずれないようにする。
const SIZES = {
  body: { width: 128, height: 180, image: "w-32 h-auto", tombstone: "h-44 w-32" },
  addendum: { width: 96, height: 128, image: "h-24 w-auto object-contain bg-gray-50", tombstone: "h-24 w-20" },
} as const;

/**
 * 添付画像1枚。運営者が削除したものは画像の代わりに墓標を出す。
 *
 * ⭐ **黙って消さない**のが要点。規約第6条3項は「運営者が編集したらその旨を投稿の表示上に明示する」
 * ことを運営者の義務にしている。画像を消して詰めてしまうと、読み手には**最初から無かったのと
 * 区別が付かない**（投稿者自身が消した場合は自分の投稿の修正なので、この明示の対象外＝行ごと消える）。
 *
 * ⚠️ 墓標の Storage ファイルは実在しないので `imageUrl` を持たない（型で保証 = types/report.ts）。
 */
export function ReportImageOrTombstone({
  image,
  alt,
  size = "body",
}: {
  image: ReportImageView;
  alt: string;
  size?: keyof typeof SIZES;
}) {
  const style = SIZES[size];

  if (image.removedByOperator) {
    return (
      <p
        className={`flex items-center justify-center rounded border border-dashed border-gray-300 px-2 text-center text-xs text-gray-500 ${style.tombstone}`}
      >
        運営者が削除しました
      </p>
    );
  }

  return (
    <a href={image.imageUrl} target="_blank" rel="noopener noreferrer">
      <Image
        src={image.imageUrl}
        alt={alt}
        width={style.width}
        height={style.height}
        unoptimized
        className={`rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in ${style.image}`}
      />
    </a>
  );
}
