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

// 全角数字（１４１）を半角（141）に畳む。IME の確定の仕方によって全角のまま残ることがあり、
// そのままでは Number() が NaN になって「入力したのに未入力扱い」になるため、
// 値を読むすべての経路（入力欄の blur・送信直前の変換）でここを通す。
// NFKC は Unicode の正規化形式で、全角英数字・互換文字を通常の半角へ畳む
// （出典: https://unicode.org/reports/tr15/ ）。
export function normalizeDigits(value: string): string {
  return value.normalize("NFKC").trim();
}
