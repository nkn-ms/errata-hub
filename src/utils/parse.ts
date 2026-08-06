// フォームの入力欄（文字列）を DB に入れる整数に変換する。未入力・整数でない入力は null。
// <input type="number"> でも未入力は "" で届くので、その NaN をそのまま Server Action に
// 流さないための関門を1か所にまとめる。
// parseInt ではなく Number を使うのは、parseInt が "3.7"→3 や "12abc"→12 と黙って
// 切り捨ててしまうため。版・刷・ページは整数欄なので、整数として読めない値は入力ミスとみなす。
export function toIntOrNull(value: string): number | null {
  const normalized = normalizeDigits(value);
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

// ページ送りの ?page= を読む。使えない値（未指定・数字でない・0以下・小数・巨大）はすべて1ページ目に倒す。
//
// URL のクエリは誰でも手で書ける入力なので、ここを通さずに skip の計算へ流すと DB まで届いてしまう。
// 実測（2026-08-06）で、素の Number / parseInt はどちらも壊れ方が違うだけで壊れる:
//   parseInt("abc") → NaN      → Prisma が「Argument `skip` is missing」で例外＝エラー画面
//   Number("1e21")  → 1e21     → skip が 64bit に収まらず Prisma が例外＝エラー画面
// ⚠️ 範囲外ページの救済（最終ページへ寄せる等）は呼び出し側の仕事。ここが弾くのは
//    「ページ番号として読めない値」だけで、「大きすぎるページ番号」は読めた値として通す。
//
// 安全整数（Number.isSafeInteger）に限る理由は、上限を数字で決め打ちしなくて済むため。
// 安全整数の最大は約 9.0e15 なので、1ページ何件で掛けても 64bit（約 9.2e18）に収まる。
export function toPageNumber(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

// 全角数字（１４１）を半角（141）に畳む。IME の確定の仕方によって全角のまま残ることがあり、
// そのままでは Number() が NaN になって「入力したのに未入力扱い」になるため、
// 値を読むすべての経路（入力欄の blur・送信直前の変換）でここを通す。
// NFKC は Unicode の正規化形式で、全角英数字・互換文字を通常の半角へ畳む
// （出典: https://unicode.org/reports/tr15/ ）。
export function normalizeDigits(value: string): string {
  return value.normalize("NFKC").trim();
}
