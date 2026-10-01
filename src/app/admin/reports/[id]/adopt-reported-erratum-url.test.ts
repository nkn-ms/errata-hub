import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock } = vi.hoisted(() => {
  const models = {
    report: { findUnique: vi.fn() },
    book: { update: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「トランザクションの中で使うクライアント（tx）」を渡す。
      // テストでは同じモックを tx として渡すので、トランザクションの中の呼び出しも外と同じ vi.fn() に記録される。
      // ⚠️ 巻き戻りは再現しない（原子性はローカル実 DB で確認する = PR#168）。
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    createAuditLogMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// 管理者操作の中身だけを見たいので、認可・監査ログ・再描画・遷移は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { adoptReportedErratumUrlAction } from "./adopt-reported-erratum-url";

const BOOK_ID = "book-1";
const existingBook = {
  id: BOOK_ID,
  title: "テスト駆動開発",
  author: "Kent Beck",
  isbn: "9784274217883",
  coverImageUrl: null,
  erratumUrl: null,
  publisherId: null,
  publisher: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adoptReportedErratumUrlAction（申告された正誤表URLの採用）", () => {
  const REPORT_ID = "report-1";

  it("投稿が見つからなければその旨を返す", async () => {
    prismaMock.report.findUnique.mockResolvedValue(null);

    const result = await adoptReportedErratumUrlAction(REPORT_ID);

    expect(result.error).toBe("投稿が見つかりません");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("申告URLが無ければ採用しない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      id: REPORT_ID,
      bookId: BOOK_ID,
      reportedErratumUrl: null,
      book: existingBook,
    });

    const result = await adoptReportedErratumUrlAction(REPORT_ID);

    expect(result.error).toBe("採用できる正誤表URLがありません");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  // 申告値は保存時にもサニタイズ済みだが、採用の入口でも通す（公開ページにリンクとして出るため）
  it("申告URLが不正な形なら採用しない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      id: REPORT_ID,
      bookId: BOOK_ID,
      reportedErratumUrl: "ftp://example.com/errata",
      book: existingBook,
    });

    const result = await adoptReportedErratumUrlAction(REPORT_ID);

    expect(result.error).toBe("採用できる正誤表URLがありません");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("申告URLを本の公式な正誤表として採用する", async () => {
    const url = "https://example.com/errata/";
    prismaMock.report.findUnique.mockResolvedValue({
      id: REPORT_ID,
      bookId: BOOK_ID,
      reportedErratumUrl: url,
      book: existingBook,
    });
    prismaMock.book.update.mockResolvedValue({ ...existingBook, erratumUrl: url });

    const result = await adoptReportedErratumUrlAction(REPORT_ID);

    expect(result.error).toBeUndefined();
    expect(prismaMock.book.update).toHaveBeenCalledWith({
      where: { id: BOOK_ID },
      data: { erratumUrl: url },
    });
    // 採用と監査ログは1つのトランザクションの中
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});
