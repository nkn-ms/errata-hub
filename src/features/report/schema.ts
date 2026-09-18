import { z } from "zod";
import { REPORT_LIMITS } from "@/features/report/constants/report-limits";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/features/report/constants/report-messages";
import { sanitizeExternalUrl } from "@/utils/external-url";

/**
 * **投稿の入力を検査するスキーマ。** `actions/` から出してあるのは2つの理由から:
 *
 * 1. `actions/*.ts` は先頭が `"use server"` で、そこに置いた値は Server Action として扱われる。
 *    **スキーマはクライアントからも使いたい**（同じ条件を画面でも強制したい）ので、外に出す必要がある
 * 2. 新規投稿・編集・追記・管理者の更新が**同じ上限と同じ条件**を共有することを1箇所で保証する
 *
 * ⚠️ **ここに DB も認可も持ち込まない。** 検査するのは受け取った値の形だけで、
 *    「その投稿の投稿者か」「連絡済みか」はアクション側がトランザクションの中で確かめる。
 *
 * ⚠️ 画面側の同じ役目は `components/report-fields.tsx` の `reportFieldsErrors`。
 *    **いまは条件が二重に書かれている**（揃えないと「画面では通るのにサーバーで弾かれる」）。
 *    ここへ寄せる作業は backlog の「入力側の型とバリデーションを zod で1本にする」。
 */

// ISBN を本の同一性の基準にする方針のため isbn は必須。
// 形式の正規化・検証は toCanonicalIsbn（ISBN-13 へ統一）で行う。
const BookSchema = z.object({
  googleBooksId: z.string().optional(),
  title: z.string().min(1, "書籍名は必須です"),
  author: z.string().optional(),
  publisher: z.string().optional(),
  isbn: z.string().min(1, "ISBNは必須です"),
  coverImageUrl: z.string().optional(),
});

// 文字数上限は REPORT_LIMITS（フォームの maxLength と同じ値）で一元管理する。
// フォームで打ち切られる想定だが、アクション直叩き・貼り付け経路もあるのでサーバーでも弾く。
//
// 前後の空白は落とす。判断の基準は2つで、**どちらも No ならトリムしてよい**:
//   ① その空白は画面に現れるか → No（HTML は前後の空白を描画しない）
//   ② その空白は内容の一部として指摘の対象になりうるか → No
//      （誤/正 は紙面からの書き写しで、紙面の「前後の空白」はそもそも観測できない）
// 残すと「見た目は同じなのに比較・検索・重複判定だけが食い違う」という説明できない挙動になる。
// ⚠️ trim は**文字列全体の前後**であって各行の前後ではない。複数行のコード例を貼っても
//    中間行の行末空白は残るので、引用の内部構造は壊れない。
// ⚠️ 全角/半角の違いはトリムでは変わらない（"ＡＰＩ".trim() === "ＡＰＩ"）。
//    そちらは意味のある差として保つ＝正規化はしない。
const limited = (max: number, label: string) =>
  z.string().trim().max(max, `${label}は${max}文字以内で入力してください`);

// 新規投稿と編集で共有する（分けると上限や必須条件が片方だけ変わる）。
// クライアント側の同じ役目は components/report-fields.tsx
const reportBodyShape = {
  edition: z.number().int().positive().nullable().optional(),
  printing: z.number().int().positive().nullable().optional(),
  title: limited(REPORT_LIMITS.title, "概要").min(1, "概要は必須です"),
  type: z.enum(["ERRATA", "SUGGESTION", "OTHER"]),
  medium: z.enum(["PAPER", "EBOOK", "OTHER"]),
  page: z.number().int().positive().nullable().optional(),
  line: z.number().int().positive().nullable().optional(),
  hasMultiplePages: z.boolean().optional(),
  locationNote: limited(REPORT_LIMITS.locationNote, "位置備考").nullable().optional(),
  ebookLocation: limited(REPORT_LIMITS.ebookLocation, "位置").nullable().optional(),
  wrong: limited(REPORT_LIMITS.wrong, "誤（該当箇所）").nullable().optional(),
  correct: limited(REPORT_LIMITS.correct, "正（正しい内容）").nullable().optional(),
  content: limited(REPORT_LIMITS.content, "内容・提案").nullable().optional(),
  note: limited(REPORT_LIMITS.note, "備考").nullable().optional(),
} as const;

const ReportBodyBase = z.object(reportBodyShape);

// 種別・媒体ごとの条件付き必須。UI と同じ条件をサーバーでも強制する（アクション直叩き対策）。
function refineReportBody(data: z.infer<typeof ReportBodyBase>, ctx: z.RefinementCtx) {
  if (data.type === "ERRATA") {
    if (!data.wrong?.trim()) {
      ctx.addIssue({ code: "custom", path: ["wrong"], message: "誤（該当箇所）は必須です" });
    }
    if (!data.correct?.trim()) {
      ctx.addIssue({ code: "custom", path: ["correct"], message: "正（正しい内容）は必須です" });
    }
    // 誤と正が同じなら指摘として成立しない。誤をコピーして直し忘れたときに起きる。
    // この時点で値は limited() によりトリム済みなので、前後の空白しか違わないものも同じと見なす
    // （見えない差なので、投稿者にとっては「同じものを送った」のと変わらない）。
    // ⚠️ 一方で**全角/半角の正規化はしない**。「ＡＰＩ → API」は見える差であり、
    //    このサイトで最も価値のある種類の指摘に含まれるため、別物として通す。
    if (data.wrong && data.correct && data.wrong === data.correct) {
      ctx.addIssue({ code: "custom", path: ["correct"], message: IDENTICAL_WRONG_CORRECT_MESSAGE });
    }
  } else if (!data.content?.trim()) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "内容・提案は必須です" });
  }
  if (data.medium === "PAPER" && data.edition == null) {
    ctx.addIssue({ code: "custom", path: ["edition"], message: "版は必須です" });
  }
  if (data.medium === "PAPER" && data.page == null) {
    ctx.addIssue({ code: "custom", path: ["page"], message: "ページ番号は必須です" });
  }
  if (data.medium === "EBOOK" && !data.ebookLocation?.trim()) {
    ctx.addIssue({ code: "custom", path: ["ebookLocation"], message: "位置は必須です" });
  }
  if (data.medium === "OTHER" && !data.locationNote?.trim()) {
    ctx.addIssue({ code: "custom", path: ["locationNote"], message: "位置メモは必須です" });
  }
}

export const ReportSchema = z.object({
  book: BookSchema,
  ...reportBodyShape,
  // 投稿者が見つけた公式の正誤表 URL の申告（任意）。公開せず、管理者が採用の可否を判断する。
  // 投稿の中身ではなく本に関する情報なので、編集（ReportBodySchema）の対象には入れない
  reportedErratumUrl: limited(REPORT_LIMITS.reportedErratumUrl, "正誤表のURL").nullable().optional(),
}).superRefine((data, ctx) => {
  refineReportBody(data, ctx);
  // 正誤表 URL は任意だが、入力するなら http / https の正しい URL であること。
  // ⚠️ https 限定ではない。何を通し何を弾くか、その理由は sanitizeExternalUrl 側に書いてある
  if (data.reportedErratumUrl?.trim() && !sanitizeExternalUrl(data.reportedErratumUrl)) {
    ctx.addIssue({
      code: "custom",
      path: ["reportedErratumUrl"],
      message: "正誤表のURLは http:// または https:// から始まる正しいURLを入力してください",
    });
  }
});

export const ReportBodySchema = ReportBodyBase.superRefine(refineReportBody);
export type ReportBodyInput = z.input<typeof ReportBodySchema>;

export type ReportInput = z.input<typeof ReportSchema>;

export const ReportUpdateSchema = z.object({
  status: z.enum(["PENDING", "FORWARDED", "LISTED", "WILL_FIX", "FIXED", "WONT_FIX", "DISMISSED", "OTHER"]).optional(),
  // ⚠️ 出版社からの回答はここでは受けない（PublisherComment テーブル＝ actions/publisher-comment.ts）。
  //    この欄は**運営者自身の説明**で、書き手が管理者ひとりだから列のままでよい
  statusNote: limited(REPORT_LIMITS.statusNote, "運営者の補足").nullable().optional(),
  fixedEdition: z.number().int().positive().nullable().optional(),
  fixedPrinting: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  // OTHER（その他）は「上記で表せない事情」を意味するので、説明が無いと読者に何も伝わらない。
  // 空の OTHER を作れなくすることで、迷ったときの掃きだめになるのを防ぐ。
  if (data.status === "OTHER" && !data.statusNote?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["statusNote"],
      message: "「その他」を選んだときは、運営者の補足欄に事情を記載してください",
    });
  }
}).transform((data) => {
  // 修正版・刷は「修正済み(FIXED)」でのみ意味を持つ欄。FIXED 以外へ変更するときは、
  // クライアントが何を送ってきても null に倒す。UI 側の入力欄制御だけに頼らず、ここで
  // 不変条件を保証する（アクション直叩きでも不整合な状態を保存させない ＝ createReport が
  // 「UI と同じ条件をサーバーでも強制する」のと同じ考え方）。
  // status を含まない部分更新では現在の status が不明なので、fixed* には触れない。
  if (data.status !== undefined && data.status !== "FIXED") {
    return { ...data, fixedEdition: null, fixedPrinting: null };
  }
  return data;
});

export type ReportUpdateInput = z.input<typeof ReportUpdateSchema>;

export const AddendumSchema = z.object({
  body: limited(REPORT_LIMITS.addendum, "追記").min(1, "追記を入力してください"),
});
export type AddendumInput = z.input<typeof AddendumSchema>;
