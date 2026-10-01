import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock } = vi.hoisted(() => {
  const models = {
    book: { findUnique: vi.fn(), update: vi.fn() },
    publisher: { upsert: vi.fn() },
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

import { updateBookAction } from "./update-book";

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

const validInput = { title: "テスト駆動開発", author: "Kent Beck" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.book.findUnique.mockResolvedValue(existingBook);
  prismaMock.book.update.mockResolvedValue({ ...existingBook, publisher: null });
});

describe("updateBookAction（書誌の手修正）", () => {
  it("書籍名が空なら弾く", async () => {
    const result = await updateBookAction(BOOK_ID, { title: "  " });

    expect(result.error).toBe("書籍名は必須です");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  // 書影は許可ホスト（OpenBD / Google Books）のみ。投稿アクションは黙って null に落とすが、
  // 管理画面は手入力ミスに気づけるよう明示的にエラーで弾く
  it("書影URLが許可ホスト外なら弾く", async () => {
    const result = await updateBookAction(BOOK_ID, {
      ...validInput,
      coverImageUrl: "https://example.com/cover.jpg",
    });

    expect(result.error).toContain("書影URL");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("書影URLが許可ホストなら通る", async () => {
    const result = await updateBookAction(BOOK_ID, {
      ...validInput,
      coverImageUrl: "https://cover.openbd.jp/9784274217883.jpg",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.book.update).toHaveBeenCalled();
  });

  it("正誤表URLが http/https でなければ弾く", async () => {
    const result = await updateBookAction(BOOK_ID, {
      ...validInput,
      erratumUrl: "javascript:alert(1)",
    });

    expect(result.error).toContain("正誤表のURL");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("書籍が見つからなければその旨を返す", async () => {
    prismaMock.book.findUnique.mockResolvedValue(null);

    const result = await updateBookAction(BOOK_ID, validInput);

    expect(result.error).toBe("書籍が見つかりません");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("出版社名が空なら upsert せず紐付けを外す", async () => {
    await updateBookAction(BOOK_ID, { ...validInput, publisherName: "" });

    expect(prismaMock.publisher.upsert).not.toHaveBeenCalled();
    expect(prismaMock.book.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publisherId: null }) })
    );
  });

  it("出版社名があれば名前で upsert して紐付ける（同時実行でも重複を作らない形）", async () => {
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1", name: "オーム社" });

    await updateBookAction(BOOK_ID, { ...validInput, publisherName: "オーム社" });

    expect(prismaMock.publisher.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "オーム社" } })
    );
    expect(prismaMock.book.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publisherId: "pub-1" }) })
    );
  });

  // 「操作は成立したのに記録だけが無い」状態を作らないための構造を固定する（PR#168）
  it("更新と監査ログは1つのトランザクションの中で書く", async () => {
    await updateBookAction(BOOK_ID, validInput);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});
