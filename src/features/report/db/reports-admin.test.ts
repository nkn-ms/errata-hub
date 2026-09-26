import { describe, it, expect, vi, beforeEach } from "vitest";

// 実接続はしないので prisma はモックする（vi.mock は巻き上げられるので値は vi.hoisted で先に作る）
const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { report: { findMany: findManyMock } } }));

import { findReportsForSitemap } from "./reports-admin";

const ROW_UPDATED_AT = new Date("2026-09-01T00:00:00Z");
const LATER = new Date("2026-09-20T00:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    status: "FORWARDED",
    updatedAt: ROW_UPDATED_AT,
    book: { isbn: "9784873116860" },
    addenda: [],
    publisherComments: [],
    ...overrides,
  };
}

describe("findReportsForSitemap（サイトマップ用の投稿）", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  // 回答は別のテーブルに入るので投稿の行は変わらない。行の時刻だけを見ると、
  // いちばん大事な「回答が付いた」がサイトマップに出ない
  it("出版社の回答が付いたら、投稿ページの更新時刻はその時刻になる", async () => {
    findManyMock.mockResolvedValue([row({ publisherComments: [{ createdAt: LATER }] })]);

    const [report] = await findReportsForSitemap();

    expect(report.pageUpdatedAt).toEqual(LATER);
    // 書籍ページに効く「行の更新時刻」は変わらない（書籍ページは回答を出さない）
    expect(report.updatedAt).toEqual(ROW_UPDATED_AT);
  });

  it("追記が付いたときも、投稿ページの更新時刻はその時刻になる", async () => {
    findManyMock.mockResolvedValue([row({ addenda: [{ createdAt: LATER }] })]);

    const [report] = await findReportsForSitemap();

    expect(report.pageUpdatedAt).toEqual(LATER);
  });

  it("追記も回答も無ければ、行の更新時刻", async () => {
    findManyMock.mockResolvedValue([row()]);

    const [report] = await findReportsForSitemap();

    expect(report.pageUpdatedAt).toEqual(ROW_UPDATED_AT);
  });

  // 投稿ページは載せないが、書籍ページは却下した投稿も並べるので、除かずに印だけ付ける
  it("却下した投稿も返し、検索エンジンに載せない印を付ける", async () => {
    findManyMock.mockResolvedValue([row({ status: "DISMISSED" }), row({ id: "report-2" })]);

    const reports = await findReportsForSitemap();

    expect(reports.map((r) => [r.id, r.indexable])).toEqual([
      ["report-1", false],
      ["report-2", true],
    ]);
  });
});
