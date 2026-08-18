import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock, redirectMock } = vi.hoisted(() => {
  const models = {
    book: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    report: { findUnique: vi.fn(), count: vi.fn() },
    publisher: { upsert: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「塊の中で使うクライアント（tx）」を渡す。
      // テストでは同じモックを tx として渡すので、塊の中の呼び出しも外と同じ vi.fn() に記録される。
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
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { updateBook, deleteBook, adoptReportedErratumUrl } from "./book";

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
  prismaMock.report.count.mockResolvedValue(0);
});

describe("updateBook（書誌の手修正）", () => {
  it("書籍名が空なら弾く", async () => {
    const result = await updateBook(BOOK_ID, { title: "  " });

    expect(result.error).toBe("書籍名は必須です");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  // 書影は許可ホスト（OpenBD / Google Books）のみ。投稿アクションは黙って null に落とすが、
  // 管理画面は手入力ミスに気づけるよう明示的にエラーで弾く
  it("書影URLが許可ホスト外なら弾く", async () => {
    const result = await updateBook(BOOK_ID, {
      ...validInput,
      coverImageUrl: "https://example.com/cover.jpg",
    });

    expect(result.error).toContain("書影URL");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("書影URLが許可ホストなら通る", async () => {
    const result = await updateBook(BOOK_ID, {
      ...validInput,
      coverImageUrl: "https://cover.openbd.jp/9784274217883.jpg",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.book.update).toHaveBeenCalled();
  });

  it("正誤表URLが http/https でなければ弾く", async () => {
    const result = await updateBook(BOOK_ID, {
      ...validInput,
      erratumUrl: "javascript:alert(1)",
    });

    expect(result.error).toContain("正誤表URL");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("書籍が見つからなければその旨を返す", async () => {
    prismaMock.book.findUnique.mockResolvedValue(null);

    const result = await updateBook(BOOK_ID, validInput);

    expect(result.error).toBe("書籍が見つかりません");
    expect(prismaMock.book.update).not.toHaveBeenCalled();
  });

  it("出版社名が空なら upsert せず紐付けを外す", async () => {
    await updateBook(BOOK_ID, { ...validInput, publisherName: "" });

    expect(prismaMock.publisher.upsert).not.toHaveBeenCalled();
    expect(prismaMock.book.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publisherId: null }) })
    );
  });

  it("出版社名があれば名前で upsert して紐付ける（同時実行でも重複を作らない形）", async () => {
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1", name: "オーム社" });

    await updateBook(BOOK_ID, { ...validInput, publisherName: "オーム社" });

    expect(prismaMock.publisher.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "オーム社" } })
    );
    expect(prismaMock.book.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publisherId: "pub-1" }) })
    );
  });

  // 「操作は成立したのに記録だけが無い」状態を作らないための構造を固定する（PR#168）
  it("更新と監査ログは1つの塊の中で書く", async () => {
    await updateBook(BOOK_ID, validInput);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});

describe("deleteBook（書籍の削除）", () => {
  it("投稿が紐づく本は削除せず、件数を文言に出す", async () => {
    prismaMock.report.count.mockResolvedValue(3);

    const result = await deleteBook(BOOK_ID);

    expect(result?.error).toContain("3件の投稿");
    expect(prismaMock.book.delete).not.toHaveBeenCalled();
  });

  it("書籍が見つからなければ削除しない", async () => {
    prismaMock.book.findUnique.mockResolvedValue(null);

    const result = await deleteBook(BOOK_ID);

    expect(result?.error).toBe("書籍が見つかりません");
    expect(prismaMock.book.delete).not.toHaveBeenCalled();
  });

  it("削除できたら一覧へ戻す", async () => {
    await deleteBook(BOOK_ID);

    expect(prismaMock.book.delete).toHaveBeenCalledWith({ where: { id: BOOK_ID } });
    expect(redirectMock).toHaveBeenCalled();
  });

  it("削除と監査ログは1つの塊の中で書く", async () => {
    await deleteBook(BOOK_ID);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});

describe("adoptReportedErratumUrl（申告された正誤表URLの採用）", () => {
  const REPORT_ID = "report-1";

  it("投稿が見つからなければその旨を返す", async () => {
    prismaMock.report.findUnique.mockResolvedValue(null);

    const result = await adoptReportedErratumUrl(REPORT_ID);

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

    const result = await adoptReportedErratumUrl(REPORT_ID);

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

    const result = await adoptReportedErratumUrl(REPORT_ID);

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

    const result = await adoptReportedErratumUrl(REPORT_ID);

    expect(result.error).toBeUndefined();
    expect(prismaMock.book.update).toHaveBeenCalledWith({
      where: { id: BOOK_ID },
      data: { erratumUrl: url },
    });
    // 採用と監査ログは1つの塊の中
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});
