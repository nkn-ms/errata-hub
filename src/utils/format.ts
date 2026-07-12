// 表示用の小さな整形ヘルパー。「toISOString().split("T")[0] って何?」のような
// 解読を読み手に強いないため、意図を関数名で運ぶ。

/**
 * Date を YYYY-MM-DD 形式の文字列にする（登録日・投稿日などの日付表示用）。
 *
 * ⚠️ UTC 基準: toISOString は UTC なので、JST の午前9時前の日時は前日の日付になる。
 * 表示専用で日付の厳密さは要求しない、という現状の判断でこの挙動を許容している。
 * 現地時刻基準にしたくなったらこの関数だけ直せばよい。
 */
export function formatUtcDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * UUID の先頭8桁の短縮 ID（例: @1034b8a2 の @ の後ろ）。
 *
 * 表示名は重複・変更があり得るため、ユーザーページ・アカウント設定・投稿者名の脇に
 * 同じ短縮 ID を出して本人照合の手がかりにする。監査ログの対象 ID 表示にも使う。
 */
export function shortId(uuid: string): string {
  return uuid.slice(0, 8);
}
