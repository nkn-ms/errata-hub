// 投稿画像の制約。クライアント（フォームの事前チェック）とサーバー（API の最終検証）で共用する。
// バケット側にも同じ上限を設定している（supabase/config.toml / 本番はダッシュボード手動設定 →
// docs/dev-environment.md §9）。

export const REPORT_IMAGE_BUCKET = "report-images";

export const REPORT_IMAGE_MAX_COUNT = 3;

// Vercel サーバーレス関数のリクエストボディ上限（4.5MB）に収めるため 4MB。
// 出典: https://vercel.com/docs/functions/limitations
export const REPORT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// 許可 MIME → 保存時の拡張子。スクリーンショット・写真を想定（GIF はアニメ画像の
// 持ち込みを避けるため許可しない）。
export const REPORT_IMAGE_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
