import { describe, it, expect } from "vitest";
import {
  EMPTY_REPORT_FIELDS,
  reportFieldsErrors,
  toReportBody,
  type ReportFieldsValue,
} from "@/features/report/components/report-fields";
import { ReportBodySchema } from "@/features/report/schema";

/**
 * **画面の検査（reportFieldsErrors）とサーバーの検査（ReportBodySchema）がズレていないことを固定する。**
 *
 * 媒体・種別ごとの条件付き必須は、いま**2箇所に書かれている**。1箇所にまとめる案は測ったうえで
 * 見送った（スキーマをクライアントへ持ち込むと zod が載り **gzip +104KB**。公開の投稿詳細ページも
 * 対象になるため、48行の重複を消す代償として高すぎる = backlog）。
 *
 * ⭐ **代わりに、ズレたらここが落ちるようにする。** 守りたい性質は1つ:
 *    **画面が通した入力は、サーバーも必ず通す。** 逆（サーバーの方が緩い）は害が無い
 *    ——「画面では通るのにサーバーで弾かれる」が、投稿を書き終えた利用者を落とす唯一の形。
 *
 * ⚠️ 文言も突き合わせる。同じ欄の同じ理由で違う文言が出ると、利用者には別の問題に見える。
 */

const fields = (overrides: Partial<ReportFieldsValue>): ReportFieldsValue => ({
  ...EMPTY_REPORT_FIELDS,
  ...overrides,
});

const PAPER_ERRATA = fields({
  medium: "PAPER",
  reportType: "ERRATA",
  title: "誤植があります",
  edition: "1",
  page: "42",
  wrong: "誤った記述",
  correct: "正しい記述",
});

/** 画面が通す入力（＝エラーゼロ）。サーバーも通さなければならない。 */
const ACCEPTED: [string, ReportFieldsValue][] = [
  ["紙・誤植・必要な欄が埋まっている", PAPER_ERRATA],
  ["紙・提案・内容が埋まっている", fields({ ...PAPER_ERRATA, reportType: "SUGGESTION", content: "こうした方が読みやすい" })],
  ["電子書籍・位置が埋まっている", fields({ ...PAPER_ERRATA, medium: "EBOOK", ebookLocation: "第3章 位置1200" })],
  ["その他の媒体・位置メモが埋まっている", fields({ ...PAPER_ERRATA, medium: "OTHER", locationNote: "付録の図2" })],
  ["紙で刷・行が空（どちらも任意）", fields({ ...PAPER_ERRATA, printing: "", line: "" })],
  // 媒体を切り替えた後に前の入力が残っていても、toReportBody が関係ない欄を null に落とす
  ["電子に切り替えた後も紙の欄に入力が残っている", fields({ ...PAPER_ERRATA, medium: "EBOOK", ebookLocation: "位置1200" })],
];

/** 画面が弾く入力。サーバーも同じ欄・同じ文言で弾かなければならない。 */
const REJECTED: [string, ReportFieldsValue, string][] = [
  ["概要が空", fields({ ...PAPER_ERRATA, title: "" }), "title"],
  ["誤植なのに誤が空", fields({ ...PAPER_ERRATA, wrong: "" }), "wrong"],
  ["誤植なのに正が空", fields({ ...PAPER_ERRATA, correct: "" }), "correct"],
  ["誤と正が同じ", fields({ ...PAPER_ERRATA, wrong: "同じ文", correct: "同じ文" }), "correct"],
  ["提案なのに内容が空", fields({ ...PAPER_ERRATA, reportType: "SUGGESTION", content: "" }), "content"],
  ["紙なのに版が空", fields({ ...PAPER_ERRATA, edition: "" }), "edition"],
  ["紙なのにページが空", fields({ ...PAPER_ERRATA, page: "" }), "page"],
  ["電子なのに位置が空", fields({ ...PAPER_ERRATA, medium: "EBOOK", ebookLocation: "" }), "ebookLocation"],
  ["その他の媒体なのに位置メモが空", fields({ ...PAPER_ERRATA, medium: "OTHER", locationNote: "" }), "locationNote"],
];

// 画面のアンカー名とサーバーの欄名がずれている2つ（ハイフン区切りは HTML の id 由来）
const ANCHOR: Record<string, string> = {
  ebookLocation: "ebook-location",
  locationNote: "location-memo",
};

describe("画面とサーバーの検査が一致する", () => {
  it.each(ACCEPTED)("画面が通すならサーバーも通す: %s", (_name, value) => {
    expect(reportFieldsErrors(value)).toEqual([]);

    const parsed = ReportBodySchema.safeParse(toReportBody(value));
    // ⚠️ ここが落ちたら「画面では通るのにサーバーで弾かれる」が起きている
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it.each(REJECTED)("同じ欄を同じ文言で弾く: %s", (_name, value, serverField) => {
    const clientErrors = reportFieldsErrors(value);
    const parsed = ReportBodySchema.safeParse(toReportBody(value));

    expect(parsed.success).toBe(false);
    const serverIssue = parsed.error?.issues.find((issue) => issue.path[0] === serverField);
    expect(serverIssue).toBeDefined();

    const anchor = ANCHOR[serverField] ?? serverField;
    const clientError = clientErrors.find((error) => error.field === anchor);
    expect(clientError).toBeDefined();
    // 文言が食い違うと、利用者には別の問題が起きたように見える
    expect(clientError?.message).toBe(serverIssue?.message);
  });
});
