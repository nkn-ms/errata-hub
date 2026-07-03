import type { ReportType, Medium } from "@/generated/prisma/client";

// 種別・媒体の表示は必ずここを通す。モデル層（types/report.ts）は enum 値のまま持ち、
// 日本語ラベルはこのマップで表示直前に引く（ラベル変更がロジックを壊さないようにする縫い目）。
export const TYPE_LABELS: Record<ReportType, string> = {
  ERRATA: "正誤情報",
  SUGGESTION: "改善提案",
  OTHER: "その他",
};

export const TYPE_COLORS: Record<ReportType, string> = {
  ERRATA: "bg-purple-100 text-purple-700",
  SUGGESTION: "bg-cyan-100 text-cyan-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export const MEDIUM_LABELS: Record<Medium, string> = {
  PAPER: "紙の書籍",
  EBOOK: "電子書籍",
  OTHER: "その他（PDF・Web資料など）",
};
