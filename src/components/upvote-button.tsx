"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import type { ReportType } from "@/generated/prisma/client";
import { routes } from "@/constants/routes";
import { UPVOTE_LABELS } from "@/constants/report-labels";
import { cn } from "@/lib/utils";

type Props = {
  reportId: string;
  initialCount: number;
  initialUpvoted: boolean;
  /** 未ログインなら /login へ誘導、自分の投稿なら無効化する */
  viewer: "guest" | "owner" | "user";
  /** ボタン文言の切り替えに使う（正誤情報=自分も見つけた / 提案・その他=私もそう思う） */
  type: ReportType;
};

/**
 * 賛同ボタン（正誤情報「自分も見つけた」/ 提案・その他「私もそう思う」）。
 * 楽観更新はせず、API のレスポンス（確定した count）で表示を更新する。
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
      const res = await fetch(routes.api.reportUpvote(reportId), {
        method: upvoted ? "DELETE" : "POST",
      });
      if (!res.ok) return;
      const data: { upvoted: boolean; count: number } = await res.json();
      setUpvoted(data.upvoted);
      setCount(data.count);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
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
        upvoted
          ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
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
