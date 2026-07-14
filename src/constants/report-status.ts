import type { ReportStatus } from "@/generated/prisma/client";

// 管理画面・API 側: Prisma enum キーで参照
// 並び順は進行順（未対応 → 連絡済み → 正誤表に掲載 → 修正予定 → 修正済み）＋終端・例外。
// 管理画面のボタン列と /how-to-use の説明はこの順で表示される。
export const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "未対応",
  FORWARDED: "出版社へ連絡済み",
  LISTED: "正誤表に掲載",
  WILL_FIX: "修正予定",
  FIXED: "修正済み",
  WONT_FIX: "修正なし",
  DISMISSED: "却下",
  OTHER: "その他",
};

const STATUS_COLOR_VALUES = {
  PENDING: "bg-gray-100 text-gray-700",
  FORWARDED: "bg-blue-100 text-blue-700",
  LISTED: "bg-green-100 text-green-700",
  WILL_FIX: "bg-yellow-100 text-yellow-700",
  FIXED: "bg-green-200 text-green-800",
  WONT_FIX: "bg-red-100 text-red-700",
  DISMISSED: "bg-gray-200 text-gray-500",
  OTHER: "bg-purple-100 text-purple-700",
} as const satisfies Record<ReportStatus, string>;

const STATUS_TOOLTIP_VALUES = {
  PENDING: "投稿を受け付けました。管理者が確認中です。",
  FORWARDED: "管理者が出版社へ連絡しました。回答があれば出版社コメント欄に表示されます。",
  LISTED: "出版社が誤りと認め、公式の正誤表に掲載しました。",
  WILL_FIX: "出版社が誤りを認め、今後の刷または改訂版で修正すると回答しました。",
  FIXED: "実際の本で修正されました（重版・改訂版・電子版の更新）。どの版・刷で直ったかは詳細に表示されます。",
  WONT_FIX: "出版社が修正を行わないと判断しました。",
  DISMISSED: "管理者が無効な投稿と判断しました。",
  OTHER: "上記のいずれにも当てはまらない事情があります。出版社コメント欄の説明をご覧ください。",
} as const satisfies Record<ReportStatus, string>;

// 公開側・管理側とも Prisma enum キーで参照する（日本語ラベルは表示直前に STATUS_LABELS で引く）
export const STATUS_COLORS: Record<ReportStatus, string> = STATUS_COLOR_VALUES;
export const STATUS_TOOLTIPS: Record<ReportStatus, string> = STATUS_TOOLTIP_VALUES;
