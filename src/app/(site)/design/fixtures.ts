import type { Report } from "@/features/report/types";

// 見本用の固定データ。**DB は引かない**（このページのために本番の投稿を出す必要がない）。
// 値は実物と同じ形にしてあるので、型が変われば tsc が落ちてここも直ることになる。
//
// ⚠️ **投稿として実在しうる組み合わせにすること。** 紙（PAPER）は版とページ番号が必須で、
//    電子（EBOOK）は版・刷・ページを持たない（= report-fields.tsx の reportFieldsErrors）。
//    ここを外すと「p.undefined」のような、本番では起きない見た目を見本として出してしまう。

const base: Report = {
  id: "sample-1",
  userId: "sample-user",
  userName: "見本ユーザー",
  userIdShort: "sample01",
  isWithdrawn: false,
  title: "誤字の指摘（見本）",
  bookTitle: "リーダブルコード",
  bookAuthor: "Dustin Boswell, Trevor Foucher",
  publisher: "オライリー・ジャパン",
  isbn: "9784873115658",
  coverImage: "",
  edition: 1,
  printing: 3,
  type: "ERRATA",
  medium: "PAPER",
  page: 58,
  wrong: "変数名は短かい方がよい",
  correct: "変数名は短い方がよい",
  publisherComments: [],
  status: "PENDING",
  createdAt: "2026-08-01",
  editedAtIso: null,
  addenda: [],
  createdAtIso: "2026-08-01T09:00:00.000Z",
  upvoteCount: 3,
  imageUrls: [],
};

export const SAMPLE_REPORT: Report = base;

export const SAMPLE_REPORTS: Report[] = [
  base,
  {
    ...base,
    id: "sample-2",
    title: "章末の演習に解答が無い（見本）",
    type: "SUGGESTION",
    bookTitle: "達人プログラマー",
    bookAuthor: "David Thomas, Andrew Hunt",
    publisher: "オーム社",
    isbn: "9784274226298",
    edition: 2,
    printing: undefined,
    page: 120,
    wrong: undefined,
    correct: undefined,
    content: "第4章の演習に解答が付いていないので、巻末に追加してほしいです。",
    status: "FORWARDED",
    createdAt: "2026-08-05",
    createdAtIso: "2026-08-05T02:30:00.000Z",
    upvoteCount: 12,
  },
  {
    ...base,
    id: "sample-3",
    title: "サンプルコードが動かない（見本）",
    bookTitle: "プログラミング TypeScript",
    bookAuthor: "Boris Cherny",
    publisher: "オライリー・ジャパン",
    isbn: "9784873119045",
    medium: "EBOOK",
    // 電子書籍には版・刷・ページが無い（紙のときだけ必須になる）
    edition: undefined,
    printing: undefined,
    page: undefined,
    ebookLocation: "第3章 「型の絞り込み」の節",
    wrong: "const x: unknown = 1; x.toFixed();",
    correct: "型の絞り込みを挟む必要がある（本文の説明と一致していない）",
    status: "LISTED",
    createdAt: "2026-08-12",
    createdAtIso: "2026-08-12T11:45:00.000Z",
    upvoteCount: 7,
  },
];
