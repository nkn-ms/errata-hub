import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock, redirectMock, PrismaClientKnownRequestError } = vi.hoisted(
  () => {
    // toMessage が Prisma.PrismaClientKnownRequestError の instanceof + code で分岐する
    class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.code = code;
      }
    }
    const models = {
      publisher: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
      book: { count: vi.fn() },
    };
    return {
      prismaMock: {
        ...models,
        // $transaction はコールバックに tx を渡す。テストでは同じモックを渡すので、
        // 塊の中の呼び出しも外と同じ vi.fn() に記録される（巻き戻りは再現しない）。
        $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
      },
      createAuditLogMock: vi.fn(),
      redirectMock: vi.fn(),
      PrismaClientKnownRequestError,
    };
  }
);

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/auth", () => ({
  requireAdminOrThrow: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));

import { createPublisher, updatePublisher, deletePublisher } from "./publisher";

const PUBLISHER_ID = "pub-1";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "オーム社",
    email: "",
    emailDomain: "",
    note: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.publisher.create.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
  prismaMock.publisher.update.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
  prismaMock.publisher.delete.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
  prismaMock.publisher.findUnique.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
  prismaMock.book.count.mockResolvedValue(0);
});

describe("createPublisher（出版社の登録）", () => {
  it("出版社名が空なら弾く", async () => {
    const result = await createPublisher(undefined, form({ name: "" }));

    expect(result?.error).toBe("出版社名を入力してください");
    expect(prismaMock.publisher.create).not.toHaveBeenCalled();
  });

  it("メールアドレスの形が違えば弾く", async () => {
    const result = await createPublisher(undefined, form({ email: "not-an-email" }));

    expect(result?.error).toBe("有効なメールアドレスを入力してください");
    expect(prismaMock.publisher.create).not.toHaveBeenCalled();
  });

  it("メールアドレスは空でよい（任意項目）", async () => {
    const result = await createPublisher(undefined, form({ email: "" }));

    expect(result?.error).toBeUndefined();
    expect(prismaMock.publisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: null }) })
    );
  });

  // emailDomain は担当者の所属を確かめる一次資料としてのメモ。照合に使える形だけを通す
  // （**権限は付かない** = 自動付与は PR#160 で廃止済み）
  it("メールドメインに @ が混ざっていたら弾く", async () => {
    const result = await createPublisher(undefined, form({ emailDomain: "@ohmsha.co.jp" }));

    expect(result?.error).toContain("メールドメイン");
    expect(prismaMock.publisher.create).not.toHaveBeenCalled();
  });

  it("メールドメインが URL 形式なら弾く", async () => {
    const result = await createPublisher(undefined, form({ emailDomain: "https://ohmsha.co.jp" }));

    expect(result?.error).toContain("メールドメイン");
    expect(prismaMock.publisher.create).not.toHaveBeenCalled();
  });

  it("メールドメインが単一ラベルなら弾く", async () => {
    const result = await createPublisher(undefined, form({ emailDomain: "localhost" }));

    expect(result?.error).toContain("メールドメイン");
    expect(prismaMock.publisher.create).not.toHaveBeenCalled();
  });

  // ドメイン名は大文字小文字を区別しない（RFC 1035）ので小文字に寄せて保存する
  it("メールドメインは小文字に正規化して保存する", async () => {
    await createPublisher(undefined, form({ emailDomain: "  OhmSha.Co.JP  " }));

    expect(prismaMock.publisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailDomain: "ohmsha.co.jp" }) })
    );
  });

  // Publisher.name は @unique（投稿時に名前で upsert して名寄せするため）
  it("同名の出版社があればエラーページでなく文言で返す", async () => {
    prismaMock.publisher.create.mockRejectedValue(new PrismaClientKnownRequestError("P2002"));

    const result = await createPublisher(undefined, form({}));

    expect(result?.error).toBe("同じ名前の出版社が既に登録されています");
  });

  it("登録と監査ログは1つの塊の中で書く", async () => {
    await createPublisher(undefined, form({}));

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});

describe("updatePublisher（出版社の更新）", () => {
  it("対象が無ければエラーページでなく文言で返す", async () => {
    prismaMock.publisher.update.mockRejectedValue(new PrismaClientKnownRequestError("P2025"));

    const result = await updatePublisher(PUBLISHER_ID, undefined, form({}));

    expect(result?.error).toBe("対象の出版社が見つかりません");
  });

  it("更新と監査ログは1つの塊の中で書く", async () => {
    await updatePublisher(PUBLISHER_ID, undefined, form({}));

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});

describe("deletePublisher（出版社の削除）", () => {
  it("書籍が紐づく出版社は削除せず、件数を文言に出す", async () => {
    prismaMock.book.count.mockResolvedValue(2);

    const result = await deletePublisher(PUBLISHER_ID);

    expect(result?.error).toContain("2冊の書籍");
    expect(prismaMock.publisher.delete).not.toHaveBeenCalled();
  });

  it("紐づく書籍が無ければ削除して一覧へ戻す", async () => {
    await deletePublisher(PUBLISHER_ID);

    expect(prismaMock.publisher.delete).toHaveBeenCalledWith({ where: { id: PUBLISHER_ID } });
    expect(redirectMock).toHaveBeenCalled();
  });

  it("削除と監査ログは1つの塊の中で書く", async () => {
    await deletePublisher(PUBLISHER_ID);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});
