import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 主導線のリンク（いまは「投稿する」だけ）。押しても何かが起きるわけではなく、
// 投稿フォームへ移動する。
//
// 塗りの階層は Button の primary と同じだが、色で**遷移か操作かを分けている**。
// リンクの色が blue-600 なので、青い塗り＝連れて行く／黒い塊＝ここで何かが起きる、
// と読める（要素の選び方そのものは docs/learnings.md「URL が変わるだけなら <a>」）。
//
// ⚠️ Button と統合しない。Button は ComponentProps<"button"> なので <a> を出せず、
//    兼ねさせると type・disabled の意味が要素ごとに変わる。
export function CtaLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors",
        className
      )}
      {...props}
    />
  );
}
