// AuditLog.targetType に入れる値を一元管理する。
// ベタ書きの文字列だと打ち間違いに気づけず、リネーム時に追従できないため、
// 正解の文字列をここ1か所に集約する。値の変更はこのファイルだけで完結する。
export const TARGET_TYPE = {
  FEEDBACK: "Feedback",
  PROFILE: "Profile",
  PUBLISHER_ACCESS: "PublisherAccess",
} as const;

// TARGET_TYPE の値から「許される文字列」の型を派生させる。
// → "Feedback" | "Profile" | "PublisherAccess"
export type TargetType = (typeof TARGET_TYPE)[keyof typeof TARGET_TYPE];
