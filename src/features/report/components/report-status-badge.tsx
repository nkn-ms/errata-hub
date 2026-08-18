import type { ReportStatus } from "@/features/report/types";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TOOLTIPS } from "@/features/report/constants/report-status";
import { cn } from "@/lib/utils";

// ステータスのバッジ＋説明のツールチップ。
//
// もともとは `title` 属性だった。title は ①出るまで1〜2秒待たされる ②タッチでは出ない
// ③OS 依存の見た目で本文と地の色を選べない ④読み上げの扱いがブラウザ差で不安定、という難がある。
// ここでは「見た目のツールチップ」と「読み上げ向けの説明」を分けて解決している:
//   - 視覚: hover で出る自前のパネル（装飾なので aria-hidden）
//   - 読み上げ: sr-only の説明文をバッジの中に置き、常にアクセシビリティツリーへ載せる
//     （title と違ってブラウザ差が無い。/books /users では親要素が <Link> なので、
//      フォーカス可能な要素やボタンをここに足せない＝この形が唯一破綻しない）
//
// パネルの出る向きは呼び出し側が決める。どちらも「切られない／表を広げない」ための調整:
//   tooltipPlacement="top"  … 下に出すと overflow-x-auto のコンテナに切られる場所（表の最終行）
//   tooltipAlign="right"    … 右寄りの列。左へ開かせないとパネルの幅だけ表が横に伸びる
//                             （display:none で待たせているので、閉じている間は伸びない）
export function StatusBadge({
  status,
  tooltipPlacement = "bottom",
  tooltipAlign = "left",
  className,
}: {
  status: ReportStatus;
  tooltipPlacement?: "top" | "bottom";
  tooltipAlign?: "left" | "right";
  className?: string;
}) {
  const description = STATUS_TOOLTIPS[status];

  return (
    <span className={cn("group relative inline-flex", className)}>
      {/* ラベルの要素にはラベルだけを入れる（説明を中に混ぜると、この要素の文字列が
          「ラベル＋説明」になってラベルでの完全一致検索・テストが効かなくなる） */}
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-help",
          STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
        )}
      >
        {STATUS_LABELS[status]}
      </span>
      {/* 読み上げ用。ラベルの直後に読まれる（視覚的なパネルは hover 依存なので当てにできない） */}
      <span className="sr-only">（{description}）</span>

      <span
        aria-hidden
        className={cn(
          // pointer-events-none: パネル自身がホバー対象になると、行クリックの邪魔になる。
          // hidden/block で出し入れする（opacity で隠すと、閉じている間もパネルの幅が
          // スクロール領域に数えられて表が横スクロールになる）
          "pointer-events-none absolute z-20 hidden w-64 rounded-md bg-gray-900 px-3 py-2 group-hover:block",
          "text-xs font-normal leading-relaxed text-white shadow-lg whitespace-normal text-left",
          tooltipPlacement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          tooltipAlign === "right" ? "right-0" : "left-0"
        )}
      >
        {description}
      </span>
    </span>
  );
}
