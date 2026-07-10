/**
 * ISBN を正規の ISBN-13 形式（13桁の数字文字列）に正規化する。
 *
 * ISBN には桁数の異なる2形式があり、同じ1冊が両方で表現され得る:
 *   - ISBN-10: 10桁（〜2006年に出版された本）。末尾が 'X'（=10）のこともある。
 *   - ISBN-13: 13桁（2007/01/01 以降に移行）。先頭は 978 か 979。
 * ISBN-10 は「978 を前置してチェック数字を再計算」すると ISBN-13 になり、両者は同じ本を指す。
 *
 * そのため保存・照合の前に必ず ISBN-13 へ統一する。これにより
 * 「同じ本が ISBN-10/13 で別レコードになる」二重化を防ぎ、
 * DB の @unique 制約と名寄せ（upsert）が正しく機能する。
 *
 * チェック数字（末尾の検算用数字）が不正なものは null を返す。
 *
 * チェック数字の計算式と 10→13 変換規則の出典: International ISBN Agency「ISBN Users' Manual」
 * https://www.isbn-international.org/content/isbn-users-manual
 */
export function toCanonicalIsbn(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, "").toUpperCase();

  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return null;
    return isbn13CheckDigit(s.slice(0, 12)) === s[12] ? s : null;
  }

  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) return null;
    if (!isValidIsbn10(s)) return null;
    // ISBN-10 のチェック数字を捨て、978 を付けて ISBN-13 へ変換する
    const core = "978" + s.slice(0, 9);
    return core + isbn13CheckDigit(core);
  }

  return null;
}

/** ISBN-13 の先頭12桁からチェック数字（1文字）を計算する。 */
function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/** ISBN-10（末尾 X 可）のチェック数字が正しいか検証する。 */
function isValidIsbn10(s: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const value = s[i] === "X" ? 10 : Number(s[i]);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}
