// フォームの入力欄（文字列）を DB に入れる整数に変換する。未入力は null。
// <input type="number"> でも未入力は "" で届くので、parseInt("") の NaN を
// そのまま Server Action に流さないための関門を1か所にまとめる。
export function toIntOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
