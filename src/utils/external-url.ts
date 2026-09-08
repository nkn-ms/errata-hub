/**
 * 外部リンク（公式の正誤表 URL）を検証して正規化する。
 *
 * 書影（cover-image.ts）と違い、正誤表のホストは出版社ごとに異なるので**許可リストは作れない**。
 * その代わり、リンクとして最低限安全な形だけを通す:
 *  - http / https のみ（javascript: / data: 等のスキームはこの判定で落ちる）
 *  - ユーザー名・パスワード入りの URL（https://evil@example.com 形式）は弾く。
 *    表示上のホストと実際の接続先を誤認させる古典的な偽装に使われるため。
 *
 * http も通すのは、公式の正誤表が http のまま置かれていることが実際にあり、弾くと
 * 正誤表への導線そのものを失うため。http か https かは destinationLabelOf() が
 * 行き先の表記に出す（http にだけ印を付けるのではなく、全部を同じ形式で出して開示する）。
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
 * リンクの丸括弧に出す行き先の表記。**スキームまで出す**
 * （"https://takaaki.info/errata" → "https://takaaki.info"）。
 *
 * ⭐ **http のときだけ出す形にはしない。** それは注記を短くしただけで、
 * 「このリンクにだけ印が付く」状態は変わらない。http を通しているのはこちらの判断
 * （公式の正誤表が http のまま置かれていることが実際にあり、弾くと導線ごと失う
 * = sanitizeExternalUrl）なので、その結果をリンク先の落ち度のようには見せない。
 * **全部を同じ形式で出せば、読み手が自分で見比べられる。**
 *
 * ⚠️ クリックの時点でブラウザは何も警告しない（リンクによる移動は混在コンテンツの対象外）。
 *    警告はアドレスバーに出る＝着いた後なので、行き先の表記はこちらで出す価値がある。
 */
export function destinationLabelOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
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
