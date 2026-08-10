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
 * Date を日本時間（JST）基準の YYYY-MM-DD HH:mm:ss にする。
 *
 * 日付だけで足りる一覧では formatJstDate を使い、こちらは**同じ日に複数回起きうる出来事**を
 * 見分ける必要がある場所に使う（投稿日時と編集日時、出版社への連絡と投稿者の編集など。
 * 同日だと日付だけでは前後関係が読めない）。
 * 秒まで出すのは、投稿してすぐ直す・連絡した直後に直すといった**分をまたがない操作**が
 * 現実にあり、分止まりだと同じ表示になって前後が読めなくなるため。
 */
export function formatJstDateTime(date: Date): string {
  // toISOString は "YYYY-MM-DDTHH:mm:ss.sssZ"。ミリ秒だけ落として区切りを空白にする
  const [day, time] = new Date(date.getTime() + JST_OFFSET_MS).toISOString().split("T");
  return `${day} ${time.slice(0, 8)}`;
}

/**
 * 投稿日時を「たった今 / N分前 / N時間前 / 昨日 / N日前」の相対表記にする（新着フィードのカード用）。
 *
 * 「最新の投稿」を名乗るトップでは、絶対日付より相対表記の方が鮮度が直感的に伝わる。
 * サーバーレンダリング時点を基準に算出する（フィードはリクエストごとに再描画されるので十分）。
 * 7日より古いものは相対表記が逆に分かりにくいので JST の絶対日付（YYYY-MM-DD）へフォールバックする。
 * now は既定で現在時刻。テスト用に注入できる。
 */
export function formatRelativeJst(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMin = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (diffMin < 1) return "たった今"; // 未来（時計ずれ）もここに寄せる
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "昨日";
  if (diffDay < 7) return `${diffDay}日前`;
  return formatJstDate(then);
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
