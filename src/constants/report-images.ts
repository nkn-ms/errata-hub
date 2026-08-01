// 投稿画像の制約。クライアント（フォームの事前チェック）とサーバー（API の最終検証）で共用する。
// バケット側にも同じ上限を設定している（supabase/config.toml / 本番はダッシュボード手動設定 →
// docs/dev-environment.md §9）。

export const REPORT_IMAGE_BUCKET = "report-images";

export const REPORT_IMAGE_MAX_COUNT = 3;

// Vercel サーバーレス関数のリクエストボディ上限（4.5MB）に収めるため 4MB。
// 出典: https://vercel.com/docs/functions/limitations
export const REPORT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// 圧縮前の元ファイルの上限。圧縮すれば上の 4MB に収まる写真（スマホの写真は素で 3〜4MB 出る）を
// 選択時点で弾かないための枠。無制限にするとデコードでブラウザが固まるので天井は要る。
export const REPORT_IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// 画面・API の文言に出す MB 表記。バイト値から導出する。
// ⚠️ 直書きしないこと。枚数は `${REPORT_IMAGE_MAX_COUNT}枚までです` と定数から出しているのに
//    MB だけ数字がベタ書きで、上限を変えると文言だけが古くなる状態だった（2026-08-01 の棚卸しで修正）。
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
