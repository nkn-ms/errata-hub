// 投稿画像の制約。クライアント（フォームの事前チェック）とサーバー（API の最終検証）で共用する。
// バケット側にも同じ上限を設定している（supabase/config.toml / 本番はダッシュボード手動設定 →
// docs/dev-environment.md §9）。

export const REPORT_IMAGE_BUCKET = "report-images";

// 枚数の上限は**投稿本体と追記で別の枠**にしてある。
//
// 本体の枠は出版社へ連絡した時点で凍結する（画像を消せるのは PENDING の間だけ）。
// 1つの枠にすると、その凍結済みの枠が「連絡後に出版社から求められた証拠」の分まで
// 食ってしまい、本体で使い切った投稿は追記に画像を1枚も足せなくなる。
//
// ⚠️ 枠の単位は**投稿**であって追記ではない。「追記1件につきN枚」にすると、
//    追記の作成回数に上限が無いため1投稿あたりの総量に歯止めが無くなり、しかも
//    「短い追記を3回書けば9枚・1回にまとめれば3枚」と書き方で許容枚数が変わる。
export const REPORT_IMAGE_MAX_COUNT = 5;
export const ADDENDUM_IMAGE_MAX_COUNT = 5;

// Vercel サーバーレス関数のリクエストボディ上限（4.5MB）に収めるため 4MB。
// 出典: https://vercel.com/docs/functions/limitations
export const REPORT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// 圧縮前の元ファイルの上限。圧縮すれば上の 4MB に収まる写真（スマホの写真は素で 3〜4MB 出る）を
// 選択時点で弾かないための枠。無制限にするとデコードでブラウザが固まるので天井は要る。
export const REPORT_IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// 画面・API の文言に出す MB 表記。バイト値から導出する。
// ⚠️ 文言に MB を直書きしないこと。上限を変えたときに文言だけが古い数字のまま残る。
export const REPORT_IMAGE_MAX_MB = REPORT_IMAGE_MAX_BYTES / 1024 / 1024;
export const REPORT_IMAGE_MAX_SOURCE_MB = REPORT_IMAGE_MAX_SOURCE_BYTES / 1024 / 1024;

// 圧縮のパラメータ（utils/image-compress.ts）。
// 長辺 2000px は「紙面の文字が読めること」が下限。よくある 1024px は正誤表の指摘には効きすぎる。
export const REPORT_IMAGE_MAX_EDGE = 2000;
export const REPORT_IMAGE_QUALITY = 0.8;
// これ以下は圧縮せずそのまま通す（劣化させない・デコード時間も使わない）
export const REPORT_IMAGE_SKIP_BYTES = 1024 * 1024;

// 許可 MIME → 保存時の拡張子。スクリーンショット・写真を想定（GIF はアニメ画像の
// 持ち込みを避けるため許可しない）。
export const REPORT_IMAGE_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
