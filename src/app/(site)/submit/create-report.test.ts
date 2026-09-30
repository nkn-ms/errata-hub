// 投稿の作成（createReportAction）を検査する。書籍と出版社の用意もする＝複数のフィーチャーにまたがる
// 操作なので、実装は app にある。投稿のほかの操作のテストは features/report/actions/report.test.ts。
// モックは、この操作が使うものだけを置く。
import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, checkRateLimitMock, fetchOpenBdBooksMock } = vi.hoisted(() => ({
  prismaMock: {
    report: { create: vi.fn() },
    book: { upsert: vi.fn(), findUnique: vi.fn() },
    publisher: { upsert: vi.fn() },
  },
  getUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  fetchOpenBdBooksMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// レート制限は既定で「通す」に固定する。モックしないと prisma モックに $queryRaw が無いせいで
// fail open に落ちて素通りし、上限に達したときの分岐がテストされていないことに気づけない
vi.mock("@/services/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
// 書籍を新しく作るときだけ OpenBD を引く（create-report.ts の findOrCreateBook）。既定は「該当なし」
vi.mock("@/lib/openbd", () => ({ fetchOpenBdBooks: fetchOpenBdBooksMock }));

import { createReportAction } from "./create-report";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/features/report/constants/report-messages";
import { BOOK_LIMITS, REPORT_LIMITS } from "@/features/report/constants/report-limits";
import { RATE_LIMITS } from "@/constants/rate-limits";

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  prismaMock.book.findUnique.mockResolvedValue(null);
  fetchOpenBdBooksMock.mockResolvedValue([]);
});

describe("文字数上限（フォームの maxLength をサーバーでも強制する）", () => {
  // フォームでは maxLength で打ち切られるが、アクション直叩きでは効かないのでサーバー側を検証する
  const validInput = {
    book: { title: "テスト駆動開発", isbn: "9784274217883" },
    title: "第3章の説明が分かりにくい",
    type: "SUGGESTION",
    medium: "EBOOK",
    ebookLocation: "位置No.1234",
    content: "もう少し具体例があると読みやすいと思います",
  } as const;


  it("上限ちょうどの本文は通る（境界値）", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-1" });

    const result = await createReportAction({
      ...validInput,
      content: "あ".repeat(REPORT_LIMITS.content),
    });

    expect(result).toEqual({ id: "report-1" });
  });

  it("上限を1文字超えた本文は保存させない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await createReportAction({
      ...validInput,
      content: "あ".repeat(REPORT_LIMITS.content + 1),
    });

    expect(result).toEqual({ error: `内容・提案は${REPORT_LIMITS.content}文字以内で入力してください` });
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });
});

describe("レート制限", () => {
  const validInput = {
    book: { title: "テスト駆動開発", isbn: "9784274217883" },
    title: "第3章の説明が分かりにくい",
    type: "SUGGESTION",
    medium: "EBOOK",
    ebookLocation: "位置No.1234",
    content: "もう少し具体例があると読みやすいと思います",
  } as const;


  it("上限に達したら投稿を保存しない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 3600 });

    const result = await createReportAction(validInput);

    expect(result.error).toContain("操作が多すぎます");
    // 書籍・出版社の upsert すら起こさない（弾くなら書き込みの手前で弾く）
    expect(prismaMock.report.create).not.toHaveBeenCalled();
    expect(prismaMock.book.upsert).not.toHaveBeenCalled();
    expect(prismaMock.publisher.upsert).not.toHaveBeenCalled();
  });

  it("投稿の上限はユーザーごとに数える", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-1" });

    await createReportAction(validInput);

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      "createReport:user-1",
      RATE_LIMITS.createReport
    );
  });

  it("未認証はレート制限を消費しない（認証で先に弾く）", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await createReportAction(validInput);

    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});

describe("createReportAction（誤と正が同じ投稿を弾く）", () => {
  // 他の必須項目は全部満たした状態にして、誤/正 の一致だけを見る
  const baseInput = {
    book: { title: "テスト駆動開発", isbn: "9784873115948" },
    title: "p.42 の誤植",
    type: "ERRATA" as const,
    medium: "PAPER" as const,
    edition: 1,
    page: 42,
  };

  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("誤と正が完全に同じならエラーにする", async () => {
    const result = await createReportAction({ ...baseInput, wrong: "冪等", correct: "冪等" });
    expect(result.error).toBe(IDENTICAL_WRONG_CORRECT_MESSAGE);
    // 弾くべき投稿で DB を触っていないこと（バリデーションは書き込みより手前）
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  // 前後の空白は①画面に現れず②指摘の対象にもなり得ない（紙面の「前後の空白」は観測できない）ので
  // 保存前にトリムする。結果、空白しか違わないものは「同じ」と見なして弾く
  it("前後の空白しか違わないものは同じと見なして弾く", async () => {
    const result = await createReportAction({ ...baseInput, wrong: " 冪等 ", correct: "冪等" });
    expect(result.error).toBe(IDENTICAL_WRONG_CORRECT_MESSAGE);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  it("値はトリムして保存する（見えない差を残さない）", async () => {
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-1" });

    await createReportAction({ ...baseInput, wrong: "  冪等  ", correct: "べき等" });
    expect(prismaMock.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wrong: "冪等", correct: "べき等" }) })
    );
  });

  // ⚠️ ここがこの機能の肝。**全角/半角の正規化はしない**。
  // 「ＡＰＩ → API」は画面に現れる差であり、このサイトで最も価値のある種類の指摘に含まれる。
  // 正規化してから比べると、そういう投稿を「誤と正が同じ」と誤判定して弾いてしまう。
  it("全角と半角の違いだけの指摘も通す", async () => {
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-2" });

    const result = await createReportAction({ ...baseInput, wrong: "ＡＰＩ", correct: "API" });
    expect(result.error).toBeUndefined();
    expect(result.id).toBe("report-2");
  });
});

describe("createReportAction（書誌はブラウザの値を信じず OpenBD を正とする）", () => {
  const input = {
    book: { title: "送られてきた書名", author: "送られてきた著者", publisher: "架空出版", isbn: "9784873115948" },
    title: "p.42 の誤植",
    type: "ERRATA" as const,
    medium: "PAPER" as const,
    edition: 1,
    page: 42,
    wrong: "誤",
    correct: "正",
  };
  const openBdBook = {
    isbn: "9784873115948",
    title: "OpenBD の書名",
    author: "OpenBD の著者",
    publisher: "オライリー・ジャパン",
    coverImageUrl: "",
    googleBooksId: "",
  };

  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-1" });
  });

  it("新しい書籍は OpenBD の書誌で作る（出版社も OpenBD の名前で紐づける）", async () => {
    fetchOpenBdBooksMock.mockResolvedValue([openBdBook]);

    const result = await createReportAction(input);

    expect(result).toEqual({ id: "report-1" });
    expect(fetchOpenBdBooksMock).toHaveBeenCalledWith(["9784873115948"]);
    expect(prismaMock.publisher.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "オライリー・ジャパン" } })
    );
    expect(prismaMock.book.upsert.mock.calls[0][0].create).toMatchObject({
      title: "OpenBD の書名",
      author: "OpenBD の著者",
      publisherId: "pub-1",
    });
  });

  it("OpenBD に無い項目だけ送られてきた値で埋める", async () => {
    fetchOpenBdBooksMock.mockResolvedValue([{ ...openBdBook, author: "", publisher: "" }]);

    await createReportAction(input);

    expect(prismaMock.publisher.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "架空出版" } })
    );
    expect(prismaMock.book.upsert.mock.calls[0][0].create).toMatchObject({
      title: "OpenBD の書名",
      author: "送られてきた著者",
    });
  });

  it("OpenBD が落ちていても投稿は受け付ける（送られてきた値で作り、管理者が後から直せる）", async () => {
    fetchOpenBdBooksMock.mockRejectedValue(new Error("OpenBD API error: 503"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createReportAction(input);

    expect(result).toEqual({ id: "report-1" });
    expect(prismaMock.book.upsert.mock.calls[0][0].create).toMatchObject({ title: "送られてきた書名" });
  });

  it("既にある書籍には触らない（OpenBD も引かず、出版社も作らない）", async () => {
    prismaMock.book.findUnique.mockResolvedValue({ id: "book-existing" });

    await createReportAction(input);

    expect(fetchOpenBdBooksMock).not.toHaveBeenCalled();
    expect(prismaMock.publisher.upsert).not.toHaveBeenCalled();
    expect(prismaMock.book.upsert).not.toHaveBeenCalled();
    expect(prismaMock.report.create.mock.calls[0][0].data.bookId).toBe("book-existing");
  });

  it("書誌にも上限がある（OpenBD に無い本では送られてきた値がそのまま公開ページに出るため）", async () => {
    const result = await createReportAction({
      ...input,
      book: { ...input.book, title: "あ".repeat(BOOK_LIMITS.title + 1) },
    });

    expect(result.error).toBe(`書籍名は${BOOK_LIMITS.title}文字以内にしてください`);
    expect(prismaMock.book.upsert).not.toHaveBeenCalled();
  });
});
