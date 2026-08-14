import { describe, it, expect, vi, beforeEach } from "vitest";
import { REPORT_LIMITS } from "@/constants/report-limits";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const {
  prismaMock,
  getUserMock,
  checkRateLimitMock,
  createAuditLogMock,
  checkPermissionMock,
} = vi.hoisted(() => {
  const models = {
    publisherComment: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // 塊の中の呼び出しも外と同じ vi.fn() に記録される（⚠️ 巻き戻りは再現しない）
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    createAuditLogMock: vi.fn(),
    checkPermissionMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// レート制限は既定で「通す」に固定する（モックしないと fail open で素通りし、
// 上限に達したときの分岐がテストされていないことに気づけない = report.test.ts と同じ理由）
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
// 認可そのものは services/publisher-access.test.ts で見る。ここでは
// 「判定結果をアクションが正しく使うか」だけを見たいので差し替える
vi.mock("@/services/publisher-access", () => ({
  checkPublisherCommentPermission: checkPermissionMock,
}));
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { addPublisherComment, deletePublisherComment } from "./publisher-comment";

const USER_ID = "user-1";
const REPORT_ID = "report-1";
const PUBLISHER_ID = "publisher-1";

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  checkPermissionMock.mockResolvedValue({ publisherId: PUBLISHER_ID, byAdmin: false });
  prismaMock.publisherComment.create.mockResolvedValue({
    id: "comment-1",
    body: "第3刷で修正します",
    byAdmin: false,
    createdAt: new Date("2026-08-12T01:00:00.000Z"),
    publisher: { name: "オーム社" },
  });
});

describe("addPublisherComment（出版社として回答する）", () => {
  it("未ログインでは書けない", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await addPublisherComment(REPORT_ID, { body: "回答" });

    expect(result.error).toBe("認証が必要です");
    expect(prismaMock.publisherComment.create).not.toHaveBeenCalled();
  });

  it("空の回答は保存しない", async () => {
    const result = await addPublisherComment(REPORT_ID, { body: "   " });

    expect(result.error).toBe("回答を入力してください");
    expect(prismaMock.publisherComment.create).not.toHaveBeenCalled();
  });

  it("上限を超える回答は保存しない", async () => {
    const result = await addPublisherComment(REPORT_ID, {
      body: "あ".repeat(REPORT_LIMITS.publisherComment + 1),
    });

    expect(result.error).toBe(
      `回答は${REPORT_LIMITS.publisherComment}文字以内で入力してください`
    );
    expect(prismaMock.publisherComment.create).not.toHaveBeenCalled();
  });

  it("レート制限に達していれば保存しない", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 60 });

    const result = await addPublisherComment(REPORT_ID, { body: "回答" });

    expect(result.error).toBeDefined();
    expect(prismaMock.publisherComment.create).not.toHaveBeenCalled();
  });

  it("権限が無ければ、判定側の理由をそのまま返す", async () => {
    checkPermissionMock.mockResolvedValue({ error: "この投稿に回答する権限がありません。" });

    const result = await addPublisherComment(REPORT_ID, { body: "回答" });

    expect(result.error).toBe("この投稿に回答する権限がありません。");
    expect(prismaMock.publisherComment.create).not.toHaveBeenCalled();
  });

  // 「どの出版社としての発言か」は判定が返した値を使う（クライアントの申告では決めない）
  it("判定が返した出版社・代理記載の別をそのまま行に書く", async () => {
    checkPermissionMock.mockResolvedValue({ publisherId: PUBLISHER_ID, byAdmin: true });

    await addPublisherComment(REPORT_ID, { body: "第3刷で修正します" });

    expect(prismaMock.publisherComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reportId: REPORT_ID,
          publisherId: PUBLISHER_ID,
          body: "第3刷で修正します",
          authorId: USER_ID,
          byAdmin: true,
        },
      })
    );
  });

  // 見ているのは「判定を送信のたびにやり直しているか」であって、競合に勝てることではない
  // （READ COMMITTED では閉じない＝ services/publisher-access.ts のコメント）
  it("権限の判定は画面ではなくサーバー側でやり直す", async () => {
    await addPublisherComment(REPORT_ID, { body: "回答" });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    // tx（$transaction が渡すクライアント）を受け取って判定していること
    expect(checkPermissionMock).toHaveBeenCalledWith(USER_ID, REPORT_ID, expect.anything());
  });

  it("作った行を返す（呼び出し側が一覧に足すため）", async () => {
    const result = await addPublisherComment(REPORT_ID, { body: "第3刷で修正します" });

    expect(result.comment).toEqual({
      id: "comment-1",
      publisherName: "オーム社",
      body: "第3刷で修正します",
      byAdmin: false,
      createdAt: expect.any(String),
    });
  });
});

describe("deletePublisherComment（運営者のモデレーション）", () => {
  beforeEach(() => {
    prismaMock.publisherComment.findUnique.mockResolvedValue({
      id: "comment-1",
      reportId: REPORT_ID,
      body: "第3刷で修正します",
      byAdmin: false,
      createdAt: new Date("2026-08-12T01:00:00.000Z"),
      publisher: { name: "オーム社" },
    });
  });

  it("見つからなければ何も消さない", async () => {
    prismaMock.publisherComment.findUnique.mockResolvedValue(null);

    const result = await deletePublisherComment("comment-1");

    expect(result.error).toBe("回答が見つかりません");
    expect(prismaMock.publisherComment.delete).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  // 行ごと消えるので、記録に当時の値が残っていないと後から何を消したのか分からない
  it("削除と監査ログを同じ塊で書き、消した内容を記録に残す", async () => {
    const result = await deletePublisherComment("comment-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.publisherComment.delete).toHaveBeenCalledWith({
      where: { id: "comment-1" },
    });
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE_PUBLISHER_COMMENT",
        targetType: "PublisherComment",
        targetId: "comment-1",
        before: expect.objectContaining({
          // 出版社は id ではなく名前で残す（AuditLog は90日で消え、後から引き直せない）
          publisherName: "オーム社",
          body: "第3刷で修正します",
        }),
      }),
      expect.anything()
    );
  });
});
