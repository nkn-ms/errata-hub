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
    medium: "PAPER",
    status: "PENDING",
    edition: null,
    printing: null,
    page: 12,
    line: 3,
    hasMultiplePages: false,
    locationNote: null,
    ebookLocation: null,
    wrong: "誤",
    correct: "正",
    content: null,
    note: null,
    publisherComment: null,
    fixedEdition: null,
    fixedPrinting: null,
    createdAt: new Date("2026-06-18T09:30:00.000Z"),
    // 未編集・追記なしの投稿。⚠️ 省略してはいけない — DB からは必ず値が来る
    // （editedAt は nullable なので Date か null、addenda は reportInclude で必ず入る）。
    // 省くとマッパー側に現実には要らない undefined の手当てを足すことになる（#178 と同じ型の罠）
    editedAt: null,
    addenda: [],
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
  it("type / medium / status は enum 値のまま通す（日本語化は表示層の責務）", () => {
    const r = mapReport(buildPrismaReport());
    expect(r.type).toBe("ERRATA");
    expect(r.medium).toBe("PAPER");
    expect(r.status).toBe("PENDING");
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

  it("createdAt は YYYY-MM-DD 形式・createdAtIso は生の ISO を保つ", () => {
    const r = mapReport(buildPrismaReport());
    expect(r.createdAt).toBe("2026-06-18");
    // 相対表記（フィード）用に元のタイムスタンプも残す
    expect(r.createdAtIso).toBe("2026-06-18T09:30:00.000Z");
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

  // isbn はここで null にしない。Book.isbn は NOT NULL（本の同一性の基準）なので、
  // null を与えると DB に存在しえない状態を検査することになる（この builder は
  // `as unknown as` で型を通すため、書けてしまうが通らない）。
  it("publisher が無ければ空文字にする", () => {
    const r = mapReport(
      buildPrismaReport({
        book: { title: "出版社なし書籍", author: null, isbn: "9784000000001", coverImageUrl: null, publisher: null },
      })
    );
    expect(r.publisher).toBe("");
    expect(r.bookAuthor).toBe("");
  });
});
