"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import type { ReportType } from "@/generated/prisma/client";
import { toggleUpvote } from "@/features/report/actions/report";
import { routes } from "@/constants/routes";
import { UPVOTE_LABELS } from "@/features/report/constants/report-labels";
import { cn } from "@/lib/utils";

/** 閲覧者の立場。guest=未ログイン / owner=投稿者本人 / user=それ以外のログイン済み */
export type ViewerRole = "guest" | "owner" | "user";

type Props = {
  reportId: string;
  initialCount: number;
  initialUpvoted: boolean;
  /** 未ログインなら /login へ誘導、自分の投稿なら無効化する */
  viewer: ViewerRole;
  /** ボタン文言の切り替えに使う（正誤情報=自分も見つけた / 提案・その他=私もそう思う） */
  type: ReportType;
};

/**
 * 賛同ボタン（正誤情報「自分も見つけた」/ 提案・その他「私もそう思う」）。
 * 楽観更新はせず、Server Action の戻り値（確定した count）で表示を更新する。
 */
export function UpvoteButton({ reportId, initialCount, initialUpvoted, viewer, type }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [isPending, startTransition] = useTransition();

  const disabled = viewer === "owner" || isPending;

  function handleClick() {
    if (viewer === "guest") {
      router.push(routes.login);
      return;
    }
    startTransition(async () => {
      const result = await toggleUpvote(reportId, !upvoted);
      if (result.error !== undefined) return;
      setUpvoted(result.upvoted);
      setCount(result.count);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      // 賛同済みかどうかは色とアイコンの塗りつぶしだけで示していて、ラベル文字列は変わらない。
      // aria-pressed が無いと支援技術には押す前後の区別が付かない。
      // 未ログインは「押せる（ログインへ進む）」だけで賛同状態を持たないので付けない。
      aria-pressed={viewer === "guest" ? undefined : upvoted}
      title={
        viewer === "owner"
          ? "自分の投稿には賛同できません"
          : viewer === "guest"
            ? "賛同するにはログインが必要です"
            : upvoted
              ? "賛同を取り消す"
              : `${UPVOTE_LABELS[type]}（賛同する）`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer",
        // disabled でも :hover は当たるので、押せないときは色を戻す
        // （自分の投稿にはこのボタンが disabled で出る＝反応すると押せるように見える）
        upvoted
          ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:hover:bg-blue-50"
          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:hover:bg-white",
        viewer === "owner" && "opacity-50 cursor-not-allowed",
        isPending && "opacity-60"
      )}
    >
      <ThumbsUp className={cn("w-4 h-4", upvoted && "fill-current")} />
      <span>{UPVOTE_LABELS[type]}</span>
      <span className={cn("font-semibold", upvoted ? "text-blue-700" : "text-gray-700")}>{count}</span>
    </button>
  );
}
