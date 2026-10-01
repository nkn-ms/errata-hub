import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock, redirectMock } = vi.hoisted(() => {
  const models = {
    book: { findUnique: vi.fn(), delete: vi.fn() },
    report: { count: vi.fn() },
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
    redirectMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// 管理者操作の中身だけを見たいので、認可・監査ログ・再描画・遷移は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { deleteBookAction } from "./delete-book";

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
  prismaMock.book.findUnique.mockResolvedValue(existingBook);
  prismaMock.report.count.mockResolvedValue(0);
});

describe("deleteBookAction（書籍の削除）", () => {
  it("投稿が紐づく本は削除せず、件数を文言に出す", async () => {
    prismaMock.report.count.mockResolvedValue(3);

    const result = await deleteBookAction(BOOK_ID);

    expect(result?.error).toContain("3件の投稿");
    expect(prismaMock.book.delete).not.toHaveBeenCalled();
  });

  it("書籍が見つからなければ削除しない", async () => {
    prismaMock.book.findUnique.mockResolvedValue(null);

    const result = await deleteBookAction(BOOK_ID);

    expect(result?.error).toBe("書籍が見つかりません");
    expect(prismaMock.book.delete).not.toHaveBeenCalled();
  });

  it("削除できたら一覧へ戻す", async () => {
    await deleteBookAction(BOOK_ID);

    expect(prismaMock.book.delete).toHaveBeenCalledWith({ where: { id: BOOK_ID } });
    expect(redirectMock).toHaveBeenCalled();
  });

  it("削除と監査ログは1つのトランザクションの中で書く", async () => {
    await deleteBookAction(BOOK_ID);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});
