// AuditLog.targetType に入れる値を一元管理する。
// ベタ書きの文字列だと打ち間違いに気づけず、リネーム時に追従できないため、
// 正解の文字列をここ1か所に集約する。値の変更はこのファイルだけで完結する。
export const TARGET_TYPE = {
  REPORT: "Report",
  PROFILE: "Profile",
  PUBLISHER_ACCESS: "PublisherAccess",
  BOOK: "Book",
  PUBLISHER: "Publisher",
} as const;

// TARGET_TYPE の値から「許される文字列」の型を派生させる。
// → "Report" | "Profile" | "PublisherAccess" | "Book" | "Publisher"
export type TargetType = (typeof TARGET_TYPE)[keyof typeof TARGET_TYPE];

// AuditLog.action に入れる値。以前は各アクションでベタ書きしていたため、
// 操作を増やしたときに下の ACTION_LABELS への追加を忘れても誰も気づけなかった
// （#160 の出版社3件と #173 の WITHDRAWAL_INCOMPLETE が実際に取りこぼされ、
//   管理画面の絞り込みに出てこない状態が続いた）。ここに集約して型で縛る。
//
// ⚠️ **値の文字列は変えないこと。** 過去に書かれた AuditLog の行がこの文字列を持っており、
//    変えると古い記録が絞り込みから外れる（キーの追加・ラベルの変更は自由）。
export const AUDIT_ACTION = {
  UPDATE_REPORT: "UPDATE_REPORT",
  DELETE_REPORT: "DELETE_REPORT",
  DELETE_REPORT_IMAGE: "DELETE_REPORT_IMAGE",
  ADOPT_ERRATUM_URL: "ADOPT_ERRATUM_URL",
  UPDATE_USER_ROLE: "UPDATE_USER_ROLE",
  GRANT_PUBLISHER_ACCESS: "GRANT_PUBLISHER_ACCESS",
  REVOKE_PUBLISHER_ACCESS: "REVOKE_PUBLISHER_ACCESS",
  UPDATE_BOOK: "UPDATE_BOOK",
  DELETE_BOOK: "DELETE_BOOK",
  CREATE_PUBLISHER: "CREATE_PUBLISHER",
  UPDATE_PUBLISHER: "UPDATE_PUBLISHER",
  DELETE_PUBLISHER: "DELETE_PUBLISHER",
  WITHDRAW_USER: "WITHDRAW_USER",
  ADMIN_WITHDRAW_USER: "ADMIN_WITHDRAW_USER",
  WITHDRAWAL_INCOMPLETE: "WITHDRAWAL_INCOMPLETE",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

// 管理画面（/admin/logs）の表示ラベルと、絞り込みドロップダウンの選択肢。
// Record<AuditAction, string> なので、AUDIT_ACTION に足してここに足し忘れると tsc が落ちる
// （＝取りこぼしが構造的に起きなくなる。これがこのファイルに集約した目的）。
//
// 並びはそのままドロップダウンの並びになる。操作の対象でまとめてある:
// 投稿 → ユーザー → 書籍マスタ → 出版社マスタ → 退会。
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  UPDATE_REPORT: "投稿更新",
  DELETE_REPORT: "投稿削除",
  DELETE_REPORT_IMAGE: "添付画像削除",
  ADOPT_ERRATUM_URL: "正誤表URL採用",
  UPDATE_USER_ROLE: "ロール変更",
  GRANT_PUBLISHER_ACCESS: "出版社アクセス付与",
  REVOKE_PUBLISHER_ACCESS: "出版社アクセス削除",
  UPDATE_BOOK: "書籍更新",
  DELETE_BOOK: "書籍削除",
  CREATE_PUBLISHER: "出版社作成",
  UPDATE_PUBLISHER: "出版社更新",
  DELETE_PUBLISHER: "出版社削除",
  WITHDRAW_USER: "退会",
  ADMIN_WITHDRAW_USER: "退会（管理者代行）",
  // 「失敗」ではない: PII のスクラブは成立していて取り消せず、もう一度実行すれば完了する。
  // 状態を正確に言うと「スクラブ済みなのに auth.users が残り、まだログインできる」。
  // 退会2件の隣に並ぶので、探しているときに目に入る（記録の目的は放置を防ぐこと）。
  WITHDRAWAL_INCOMPLETE: "退会（未完了）",
};

// 表示のとき「DB に入っている文字列」で引くための入口。
//
// AUDIT_ACTION_LABELS の型は Record<AuditAction, string> のままにして完全性を tsc に見てもらい、
// 引く側だけ string を受ける形に広げる。⚠️ キャスト（`as AuditAction`）で黙らせないこと。
// **AuditLog.action は過去に書かれた値がそのまま残る列**で、将来ここから消した操作の行も居座るため、
// 「必ず引ける」と断言すると型が嘘になる（docs/learnings.md「キャストが型に嘘をついていた」の節）。
// 定義に無い値はラベルに直さず、生の文字列をそのまま見せる（読めない方がまだ正確）。
const LABEL_LOOKUP: Record<string, string | undefined> = AUDIT_ACTION_LABELS;

export function auditActionLabel(action: string): string {
  return LABEL_LOOKUP[action] ?? action;
}
