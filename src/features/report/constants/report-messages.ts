// 投稿フォームの検証メッセージのうち、**クライアントとサーバーの両方が出すもの**を置く。
//
// なぜ独立したファイルなのか: 検証本体は actions/report.ts（"use server"）にあるが、
// **"use server" ファイルは async 関数以外を export できない**（next build が
// "Only async functions are allowed to be exported in a \"use server\" file." で落ちる。
// tsc と eslint は通るので、この制約はビルドしないと分からない）。
// かといって文言を両側に直書きすると、片方だけ直したときに気づけない。

/** 誤と正が同じ内容のとき。クライアントの即時チェックとサーバーの検証で同じ文言を出す */
export const IDENTICAL_WRONG_CORRECT_MESSAGE = "誤と正が同じ内容です。正しい内容に直してください";
