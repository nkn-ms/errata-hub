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
 * 正誤表への導線そのものを失うため。http であることは destinationLabelOf() が
 * 行き先の表記に出して開示する。
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
 * リンクの丸括弧に出す行き先の表記。**https はホスト名だけ・http はスキームまで出す**
 * （"https://takaaki.info/errata" → "takaaki.info" / "http://takaaki.info/errata" → "http://takaaki.info"）。
 *
 * ⭐ **http を通しているのはこちらの判断**（出版社の正誤表が http のまま置かれていることが実際にあり、
 * 弾くと導線ごと失う = sanitizeExternalUrl）。その結果を「保護されていない接続」と注記すると、
 * こちらの判断の結果をリンク先の落ち度のように見せることになる。行き先を示す丸括弧の中に
 * http:// と書けば、**評価を足さずに同じ事実**が伝わる。
 *
 * https にスキームを付けないのは、全部に付けると目立たせたい http が並びの中に埋もれるため。
 *
 * ⚠️ 前提として、**クリックの時点でブラウザは何も警告しない**（リンクによる移動は混在コンテンツの
 *    対象外）。警告はアドレスバーに出る＝着いた後なので、行き先の表記はこちらで出す価値がある。
 */
export function destinationLabelOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" ? `http://${parsed.hostname}` : parsed.hostname;
  } catch {
    return url;
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
