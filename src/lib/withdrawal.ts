// 退会（アカウント匿名化）に関する定数とヘルパを一元管理する。
//
// 退会の方針: 投稿（Report）はコミュニティ資産として残し、投稿者の個人情報（PII）だけを
// スクラブする。Profile.email は @unique かつ必須のため null にできないので、本人の UUID を
// 使った衝突しないダミー値で上書きする。退会済みかどうかは「email がこのドメインで終わるか」で
// サーバー側だけで判定し、メール自体はクライアントへ一切渡さない。
export const WITHDRAWN_EMAIL_DOMAIN = "deleted.local";

// 退会済みユーザーの公開表示名。
export const WITHDRAWN_DISPLAY_NAME = "退会済みユーザー";

/** 本人の UUID から衝突しない匿名メールを作る（例: deleted-<uuid>@deleted.local）。 */
export function buildWithdrawnEmail(userId: string): string {
  return `deleted-${userId}@${WITHDRAWN_EMAIL_DOMAIN}`;
}

/** Profile.email が匿名化済み（＝退会済み）かを判定する。サーバー側専用。 */
export function isWithdrawnEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${WITHDRAWN_EMAIL_DOMAIN}`);
}
