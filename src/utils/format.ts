// 表示用の小さな整形ヘルパー。「toISOString().split("T")[0] って何?」のような
// 解読を読み手に強いないため、意図を関数名で運ぶ。

// 日本時間（JST）のオフセット。JST は夏時間が無く通年 UTC+9 固定なので、単純な加算で足りる。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Date を日本時間（JST）基準の YYYY-MM-DD にする（登録日・投稿日などの日付表示用）。
 *
 * サイトの主対象が日本の読者・書籍のため JST 固定とする（閲覧者のタイムゾーンは見ない）。
 * サーバー（Vercel）は UTC で動くため、+9時間ずらしてから UTC の日付部分を取ることで
 * JST の日付を得る。
 */
export function formatJstDate(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().split("T")[0];
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
