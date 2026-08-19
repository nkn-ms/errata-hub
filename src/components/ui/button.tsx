import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 押して操作を起こすボタン。文言と用途だけを呼び出し側に残し、見た目は variant で選ぶ。
//
// なぜ部品にしたか（見た目を揃えるためではない）:
//   **disabled のボタンにも CSS の :hover は当たる**。つまり `hover:bg-gray-700` だけを書くと、
//   押せない状態のボタンがマウスに反応して色を変える。この抑止（disabled:hover:*）は
//   52箇所あるボタンのうち1箇所にしか入っていなかった。1行で全部に効く場所が要る、が理由。
//
// 幅・余白・並びは呼び出し側の都合なので既定を上書きできる（cn = twMerge なので後勝ちになる）:
//   px-6 … フォームの送信ボタン（既定の px-4 より広い）
//   w-full … ログイン・退会など、1画面に1つしか操作が無いフォーム
//
// ⚠️ secondary に文字色を持たせていない。既存の11箇所は色を指定せず body の色
//    （--foreground ≒ #171717）を継いでおり、ここで text-gray-700 を足すと全部が薄くなる。
//    色が要る呼び出し側（GitHub ログイン）だけが className で渡す。
const VARIANTS = {
  primary: "bg-gray-900 text-white hover:bg-gray-700 disabled:hover:bg-gray-900",
  // 危険な操作は red-700 に統一する。退会だけ red-600（薄い方）だったが、
  // 退会は最も取り消せない操作なので「摩擦は取り消せなさに比例する」の原則と逆だった。
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:hover:bg-red-700",
  secondary: "border border-gray-300 hover:bg-gray-50 disabled:hover:bg-transparent",
  // 破壊的だが主役ではないもの（管理画面の削除）。面ではなく枠線で出す。
  dangerOutline:
    "text-red-700 border border-red-300 hover:bg-red-50 disabled:hover:bg-transparent",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      // type は既定を持たせない。フォームの中の <button> は既定が submit で、
      // ここで "button" に倒すと type を書いていない送信ボタンが黙って動かなくなる。
      className={cn(
        "px-4 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
