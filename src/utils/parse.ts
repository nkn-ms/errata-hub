// フォームの入力欄（文字列）を DB に入れる整数に変換する。未入力・整数でない入力は null。
// <input type="number"> でも未入力は "" で届くので、その NaN をそのまま Server Action に
// 流さないための関門を1か所にまとめる。
// parseInt ではなく Number を使うのは、parseInt が "3.7"→3 や "12abc"→12 と黙って
// 切り捨ててしまうため。版・刷・ページは整数欄なので、整数として読めない値は入力ミスとみなす。
export function toIntOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}
