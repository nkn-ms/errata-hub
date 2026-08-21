import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 操作の結果を伝える通知。エラー＝赤・成功＝緑という一般的な割り当てに従う。
//
// 地（50）・枠（200）・文字（700）を同じ色系で3枚とも塗る。これができるのは、
// この通知が**一度読んで終わるもの**だから。読ませ続ける中身（投稿詳細の 誤/正）は
// 逆に枠と小さいラベルだけに色を持たせる = app/(site)/reports/[id]/page.tsx。
// 地まで塗ると色が引用文に重なって読みにくくなる（特にダーク）。
//
// ⚠️ role="alert" を既定で持たせない。ログイン等の文言はサーバーからの再描画で載るので、
//    初期描画時点の alert は読み上げが安定しない。クライアント側で後から出す
//    エラーのまとめ（report-fields.tsx の ErrorPanel）だけが role を渡す。
const VARIANTS = {
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-green-50 border-green-200 text-green-700",
} as const;

export type NoticeVariant = keyof typeof VARIANTS;

export function Notice({
  variant,
  className,
  ...props
}: ComponentProps<"div"> & { variant: NoticeVariant }) {
  return (
    <div
      className={cn("rounded-md border px-3 py-2 text-sm", VARIANTS[variant], className)}
      {...props}
    />
  );
}
