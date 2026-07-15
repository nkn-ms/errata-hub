/**
 * 外部リンク（出版社の正誤表 URL）を検証して正規化する。
 *
 * 書影（cover-image.ts）と違い、正誤表のホストは出版社ごとに異なるので**許可リストは作れない**。
 * その代わり、リンクとして最低限安全な形だけを通す:
 *  - https のみ（http は通さない。中間者による書き換えを防ぐ）
 *  - javascript: / data: 等のスキームは弾く（上の https 判定で自動的に落ちる）
 *  - ユーザー名・パスワード入りの URL（https://evil@example.com 形式）は弾く。
 *    表示上のホストと実際の接続先を誤認させる古典的な偽装に使われるため。
 *
 * 「誰が入力できるか」はこの関数の外側の責務（正誤表 URL の公開は管理者のみ = schema.prisma）。
 * 表示側は rel="noopener noreferrer nofollow" を付けること。
 */
export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname) return null;

  return parsed.toString();
}

/** リンクの表示用にホスト名だけを取り出す（"https://www.example.co.jp/errata" → "www.example.co.jp"） */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
