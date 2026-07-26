import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, checkRateLimitMock, PrismaClientKnownRequestError } = vi.hoisted(() => {
  // アクションは Prisma.PrismaClientKnownRequestError の instanceof + code 判定に使う
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    prismaMock: {
      report: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      upvote: { create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
      book: { upsert: vi.fn() },
      publisher: { upsert: vi.fn() },
    },
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// レート制限は既定で「通す」に固定する。モックしないと prisma モックに $queryRaw が無いせいで
// fail open に落ちて素通りし、上限に達したときの分岐がテストされていないことに気づけない
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));
// updateReport（管理者操作）の検証だけを見たいので、認可・監査ログ・再描画は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminOrThrow: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { createReport, toggleUpvote, updateReport } from "./report";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { RATE_LIMITS } from "@/constants/rate-limits";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.upvote.count.mockResolvedValue(1);
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("toggleUpvote（賛同を付ける）", () => {
  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ error: "認証が必要です" });
  });

  it("投稿が存在しなければエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue(null);
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ error: "投稿が見つかりません" });
  });

  it("自分の投稿にはエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ error: "自分の投稿には賛同できません" });
    expect(prismaMock.upvote.create).not.toHaveBeenCalled();
  });

  it("他人の投稿への賛同は作成して {upvoted:true, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockResolvedValue({});
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ upvoted: true, count: 1 });
    expect(prismaMock.upvote.create).toHaveBeenCalledWith({
      data: { reportId: "report-1", profileId: "user-2" },
    });
  });

  it("重複賛同（P2002）は冪等に成功扱い", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2002"));
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ upvoted: true, count: 1 });
  });

  it("P2002 以外の DB エラーは汎用エラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2003"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await toggleUpvote("report-1", true);
    expect(result).toEqual({ error: "賛同に失敗しました" });
    consoleSpy.mockRestore();
  });
});

describe("toggleUpvote（賛同を取り消す）", () => {
  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await toggleUpvote("report-1", false);
    expect(result).toEqual({ error: "認証が必要です" });
  });

  it("取り消しは deleteMany（未賛同でも成功）で {upvoted:false, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.upvote.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.upvote.count.mockResolvedValue(0);
    const result = await toggleUpvote("report-1", false);
    expect(result).toEqual({ upvoted: false, count: 0 });
    expect(prismaMock.upvote.deleteMany).toHaveBeenCalledWith({
      where: { reportId: "report-1", profileId: "user-2" },
    });
  });
});

describe("updateReport（ステータス更新のバリデーション）", () => {
  it("「その他」は出版社コメントが無いと保存できない（空の OTHER を作らせない）", async () => {
    const result = await updateReport("r1", { status: "OTHER", publisherComment: "" });

    expect(result.error).toBe("「その他」を選んだときは、出版社コメント欄に事情を記載してください");
    expect(prismaMock.report.update).not.toHaveBeenCalled();
  });

  it("「その他」でも出版社コメントがあれば保存できる", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "OTHER" });

    const result = await updateReport("r1", {
      status: "OTHER",
      publisherComment: "出版社が廃業しており連絡が取れません",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.report.update).toHaveBeenCalled();
  });

  it("「その他」以外はコメント無しでも保存できる", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "LISTED" });

    const result = await updateReport("r1", { status: "LISTED", publisherComment: "" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.report.update).toHaveBeenCalled();
  });
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

    const result = await createReport({
      ...validInput,
      content: "あ".repeat(REPORT_LIMITS.content),
    });

    expect(result).toEqual({ id: "report-1" });
  });

  it("上限を1文字超えた本文は保存させない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await createReport({
      ...validInput,
      content: "あ".repeat(REPORT_LIMITS.content + 1),
    });

    expect(result).toEqual({ error: `内容・提案は${REPORT_LIMITS.content}文字以内で入力してください` });
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  it("管理者の出版社コメントにも上限がある", async () => {
    const result = await updateReport("r1", {
      status: "LISTED",
      publisherComment: "あ".repeat(REPORT_LIMITS.publisherComment + 1),
    });

    expect(result.error).toBe(
      `出版社コメントは${REPORT_LIMITS.publisherComment}文字以内で入力してください`
    );
    expect(prismaMock.report.update).not.toHaveBeenCalled();
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

    const result = await createReport(validInput);

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

    await createReport(validInput);

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      "createReport:user-1",
      RATE_LIMITS.createReport
    );
  });

  it("未認証はレート制限を消費しない（認証で先に弾く）", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await createReport(validInput);

    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("上限に達したら賛同も書き込まない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const result = await toggleUpvote("report-1", true);

    expect(result.error).toContain("操作が多すぎます");
    expect(prismaMock.upvote.create).not.toHaveBeenCalled();
  });

  it("賛同の取り消しも数える（連打は両方向に起きる）", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const result = await toggleUpvote("report-1", false);

    expect(result.error).toContain("操作が多すぎます");
    expect(prismaMock.upvote.deleteMany).not.toHaveBeenCalled();
  });
});
