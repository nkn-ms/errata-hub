// 書影URLの許可ホスト。書影は UI 上 OpenBD / Google Books 由来の URL しか設定されない想定だが、
// API は直接叩けるため、サーバー側でもこの想定を強制する（未知の第三者ホストの画像を
// 閲覧者のブラウザに直接読み込ませない＝閲覧者IPの流出・追跡画像の混入を防ぐ）。
const ALLOWED_COVER_HOSTS = new Set([
  "cover.openbd.jp", // OpenBD の書影（summary.cover）
  "books.google.com", // Google Books のサムネイル（imageLinks.thumbnail）
  "books.googleusercontent.com", // Google Books の画像配信ホスト（応答によりこちらが返る）
]);

/**
 * 書影URLを検証して正規化する。
 * - 許可ホストの URL → https に正規化して返す
 * - それ以外のホスト・不正な URL・空 → null（書影なし扱い）
 *
 * 書影は装飾情報なので、呼び出し側は「不正なら null に落とす（リクエスト全体は
 * 失敗させない）」か「400 で弾く」かを文脈で選ぶ（投稿APIは前者・管理画面は後者）。
 */
export function sanitizeCoverImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!ALLOWED_COVER_HOSTS.has(parsed.hostname)) return null;
  parsed.protocol = "https:";
  return parsed.toString();
}
