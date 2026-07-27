/**
 * 外部リンク（出版社の正誤表 URL）を検証して正規化する。
 *
 * 書影（cover-image.ts）と違い、正誤表のホストは出版社ごとに異なるので**許可リストは作れない**。
 * その代わり、リンクとして最低限安全な形だけを通す:
 *  - http / https のみ（javascript: / data: 等のスキームはこの判定で落ちる）
 *  - ユーザー名・パスワード入りの URL（https://evil@example.com 形式）は弾く。
 *    表示上のホストと実際の接続先を誤認させる古典的な偽装に使われるため。
 *
 * http も通すのは、出版社の正誤表が http のまま置かれていることが実際にあり、弾くと
 * 正誤表への導線そのものを失うため。中間者に書き換えられうる点は isInsecureUrl() で
 * 表示側に注記を出して開示する。
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

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname) return null;

  return parsed.toString();
}

/**
 * http（保護されていない接続）のリンクか。表示側で注記を出すために使う。
 * sanitizeExternalUrl を通した URL を渡す前提だが、壊れた文字列でも落ちないようにしている。
 */
export function isInsecureUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "http:";
  } catch {
    return false;
  }
}

/** リンクの表示用にホスト名だけを取り出す（"https://www.example.co.jp/errata" → "www.example.co.jp"） */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
