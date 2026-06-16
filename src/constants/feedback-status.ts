import type { FeedbackStatus } from "@/generated/prisma/client";

// 管理画面・API 側: Prisma enum キーで参照
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  PENDING: "未対応",
  FORWARDED: "出版社へ送信済み",
  IN_REVIEW: "出版社確認中",
  REPLIED: "出版社回答済み",
  WILL_FIX: "修正予定",
  FIXED: "修正済み",
  NO_ACTION: "対応なし",
  DISMISSED: "却下",
};

const STATUS_COLOR_VALUES = {
  PENDING: "bg-gray-100 text-gray-700",
  FORWARDED: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  REPLIED: "bg-green-100 text-green-700",
  WILL_FIX: "bg-yellow-100 text-yellow-700",
  FIXED: "bg-green-200 text-green-800",
  NO_ACTION: "bg-red-100 text-red-700",
  DISMISSED: "bg-gray-200 text-gray-500",
} as const satisfies Record<FeedbackStatus, string>;

const STATUS_TOOLTIP_VALUES = {
  PENDING: "投稿を受け付けました。管理者が確認中です。",
  FORWARDED: "管理者が出版社へ連絡しました。出版社からの回答待ちです。",
  IN_REVIEW: "出版社が内容を確認中です。",
  REPLIED: "出版社から回答がありました。",
  WILL_FIX: "出版社が誤植を確認し、修正予定です。",
  FIXED: "重版・改訂版で修正されました。",
  NO_ACTION: "出版社が対応不要と判断しました。",
  DISMISSED: "管理者が無効な投稿と判断しました。",
} as const satisfies Record<FeedbackStatus, string>;

// Prisma enum キーで参照（管理画面・API 側）
export const STATUS_COLORS: Record<FeedbackStatus, string> = STATUS_COLOR_VALUES;
export const STATUS_TOOLTIPS: Record<FeedbackStatus, string> = STATUS_TOOLTIP_VALUES;

// 日本語ラベルで参照（公開側コンポーネント）
export const STATUS_COLORS_BY_LABEL: Record<string, string> = Object.fromEntries(
  (Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((k) => [STATUS_LABELS[k], STATUS_COLOR_VALUES[k]])
);
export const STATUS_TOOLTIPS_BY_LABEL: Record<string, string> = Object.fromEntries(
  (Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((k) => [STATUS_LABELS[k], STATUS_TOOLTIP_VALUES[k]])
);
