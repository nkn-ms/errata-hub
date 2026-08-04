// プロフィールの入力欄の文字数上限。フォーム（maxLength）とサーバー（actions/auth.ts の zod）、
// および Profile を実際に作る auth/callback で共用する。
//
// なぜ定数にするか: 表示名の上限は**入口が3つある**（会員登録フォーム / アカウント設定 /
// OAuth 後の callback）。数値を各所に書くと、片方だけ直したときに入口ごとに上限が割れる。
//
// ⚠️ callback は「入力を弾く」ことができない（OAuth の途中でエラーにするとログインが壊れる）ので、
//    そこだけは**切り詰める**という別の守り方をする。上限そのものは同じ値を使う。
//
// 数え方は REPORT_LIMITS と同じく UTF-16 コードユニット数（maxlength と String#length が一致する）。
export const PROFILE_LIMITS = {
  displayName: 50,
} as const;
