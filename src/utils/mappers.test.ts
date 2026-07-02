import { describe, it, expect } from "vitest";
import { mapReport } from "@/utils/mappers";

type MapReportInput = Parameters<typeof mapReport>[0];

// Prisma の型は実行時に消えるため、構造的に必要なフィールドだけ与える
function buildPrismaReport(overrides: Partial<Record<string, unknown>> = {}): MapReportInput {
  const base = {
    id: "report-1",
    bookId: "book-1",
    userId: "abcdef0123456789",
    title: "誤植の報告",
    type: "ERRATA",
    locationType: "PAGE",
    status: "PENDING",
    edition: null,
    printing: null,
    page: 12,
    line: 3,
    hasMultiplePages: false,
    locationNote: null,
    kindleLocation: null,
    wrong: "誤",
    correct: "正",
    content: null,
    note: null,
    publisherComment: null,
    fixedEdition: null,
    fixedPrinting: null,
    createdAt: new Date("2026-06-18T09:30:00.000Z"),
    book: {
      title: "テスト書籍",
      author: "著者名",
      isbn: "9784000000000",
      coverImageUrl: "https://example.com/cover.jpg",
      publisher: { name: "テスト出版社" },
    },
    images: [],
    user: { displayName: "山田太郎" },
    ...overrides,
  };
  return base as unknown as MapReportInput;
}

describe("mapReport", () => {
  it("Prisma enum を日本語ラベルへ変換する", () => {
    const r = mapReport(buildPrismaReport());
    expect(r.type).toBe("正誤情報");
    expect(r.locationType).toBe("ページ");
    expect(r.status).toBe("未対応");
  });

  it("type の3種をそれぞれ変換する", () => {
    expect(mapReport(buildPrismaReport({ type: "ERRATA" })).type).toBe("正誤情報");
    expect(mapReport(buildPrismaReport({ type: "SUGGESTION" })).type).toBe("改善提案");
    expect(mapReport(buildPrismaReport({ type: "OTHER" })).type).toBe("その他");
  });

  it("displayName が無ければ匿名にフォールバックする", () => {
    expect(mapReport(buildPrismaReport({ user: null })).userName).toBe("匿名");
    expect(mapReport(buildPrismaReport({ user: { displayName: null } })).userName).toBe("匿名");
  });

  it("退会済み（匿名化メール）は投稿者名を『退会済みユーザー』にし isWithdrawn=true にする", () => {
    const r = mapReport(
      buildPrismaReport({ user: { displayName: null, email: "deleted-abc@deleted.local" } })
    );
    expect(r.userName).toBe("退会済みユーザー");
    expect(r.isWithdrawn).toBe(true);
  });

  it("通常ユーザーは isWithdrawn=false", () => {
    expect(mapReport(buildPrismaReport({ user: { displayName: "山田太郎", email: "yamada@example.com" } })).isWithdrawn).toBe(false);
  });

  it("userIdShort は先頭8文字", () => {
    expect(mapReport(buildPrismaReport()).userIdShort).toBe("abcdef01");
  });

  it("createdAt は YYYY-MM-DD 形式に整形する", () => {
    expect(mapReport(buildPrismaReport()).createdAt).toBe("2026-06-18");
  });

  it("null フィールドは undefined に正規化する", () => {
    const r = mapReport(buildPrismaReport({ page: null, line: null, content: null }));
    expect(r.page).toBeUndefined();
    expect(r.line).toBeUndefined();
    expect(r.content).toBeUndefined();
  });

  it("book のリレーションを平坦化する", () => {
    const r = mapReport(buildPrismaReport());
    expect(r.bookTitle).toBe("テスト書籍");
    expect(r.publisher).toBe("テスト出版社");
    expect(r.isbn).toBe("9784000000000");
  });

  it("賛同数（_count.upvotes）を upvoteCount に写す。_count が無ければ 0", () => {
    expect(mapReport(buildPrismaReport({ _count: { upvotes: 5 } })).upvoteCount).toBe(5);
    expect(mapReport(buildPrismaReport()).upvoteCount).toBe(0);
  });

  it("publisher が無ければ空文字にする", () => {
    const r = mapReport(
      buildPrismaReport({
        book: { title: "出版社なし書籍", author: null, isbn: null, coverImageUrl: null, publisher: null },
      })
    );
    expect(r.publisher).toBe("");
    expect(r.bookAuthor).toBe("");
    expect(r.isbn).toBe("");
  });
});
