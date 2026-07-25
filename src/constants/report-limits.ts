// 投稿の入力欄の文字数上限。フォーム（maxLength）とサーバー（actions/report.ts の zod）で共用する。
//
// なぜ要るか: Prisma の String は Postgres の text（無制限）なので、上限を書かなければ
// 事実上の壁は Server Actions のボディ上限 1MB だけになる。表示名は 50 文字で守っているのに
// 本文が野放し、という非対称を埋めるのが目的（DoS 対策というより「設計上の意図を明示する」ため）。
//
// 数え方: HTML の maxlength と JS の String#length はどちらも UTF-16 コードユニット数を数えるので、
// クライアントとサーバーで判定がずれない（絵文字など BMP 外の文字は 2 と数えられる）。
// 出典: https://html.spec.whatwg.org/multipage/input.html#attr-input-maxlength
//
// 上限に達したら入力できなくなる（maxLength）ので、値は「まっとうな投稿が収まる」側に余裕を持たせている。
export const REPORT_LIMITS = {
  title: 100,
  // 誤 / 正 は該当箇所の引用。長さは投稿者の裁量ではなく元の本文が決めるので、
  // ここは絞らない（表を丸ごと引用するような正当な投稿を弾かないため）。
  // ただし長文の丸写しは著作権上も避けたいので無制限にはしない
  wrong: 1000,
  correct: 1000,
  // 改善提案の本文。投稿の中で最も長くなる欄。1000字＝原稿用紙2.5枚で、提案としては十分
  // （比較: YouTube のコメントは 10,000 字だが、一覧は3行で切って「もっと見る」を出す＝
  //  長文問題を入力側でなく表示側で解いている。こちらも一覧は line-clamp / truncate 済み）
  content: 1000,
  // あくまで補足
  note: 500,
  locationNote: 200,
  ebookLocation: 100,
  // URL。ブラウザ・サーバーが実用上扱える長さの目安
  reportedErratumUrl: 2000,
  // 管理者が入れる出版社からの回答
  publisherComment: 2000,
} as const;
