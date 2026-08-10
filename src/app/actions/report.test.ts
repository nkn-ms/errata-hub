import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, checkRateLimitMock, createAuditLogMock, PrismaClientKnownRequestError } = vi.hoisted(() => {
  // アクションは Prisma.PrismaClientKnownRequestError の instanceof + code 判定に使う
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  const models = {
    report: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    reportImage: { findUnique: vi.fn(), delete: vi.fn() },
    reportAddendum: { create: vi.fn() },
    upvote: { create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    book: { upsert: vi.fn() },
    publisher: { upsert: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「塊の中で使うクライアント（tx）」を渡す。
      // テストでは同じモックを tx として渡すので、塊の中の呼び出しも外と同じ vi.fn() に記録される。
      // ⚠️ 巻き戻りは再現しない。ここで見るのは塊の中身の挙動であって、原子性ではない
      //    （原子性はローカル実 DB で確認する = PR#161 と同じ）。
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    createAuditLogMock: vi.fn(),
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
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { addReportAddendum, createReport, deleteOwnReportImage, toggleUpvote, updateReport } from "./report";
import { AUDIT_ACTION } from "@/constants/audit";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/constants/report-messages";
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

  // 「操作は成立したのに記録だけが無い」状態を作らないための構造を固定する。
  // 巻き戻り自体はモックでは再現できない（実 DB で確認する）ので、ここで見るのは
  // ①塊を張っていること ②監査ログをグローバルの prisma でなく tx で書いていること の2点。
  // ②を落とすと別接続で実行され、塊の外に出て静かに壊れる（services/audit.ts の警告）。
  it("ステータス更新と監査ログは1つの塊の中で書く", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "FIXED" });

    await updateReport("r1", { status: "FIXED" });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
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

  // 追記そのものは軽いが、1件ごとに画像の枠を消費できる＝投稿を増やさずに
  // 追記だけ量産する経路を塞ぐのがこの制限
  it("上限に達したら追記を保存しない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 3600 });

    const result = await addReportAddendum("report-1", { body: "追記します" });

    expect(result.error).toContain("操作が多すぎます");
    expect(prismaMock.reportAddendum.create).not.toHaveBeenCalled();
  });

  it("追記の上限はユーザーごとに数える", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue({
      id: "report-1",
      userId: "user-1",
      status: "FORWARDED",
    });
    prismaMock.reportAddendum.create.mockResolvedValue({
      id: "addendum-1",
      body: "追記します",
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
    });

    await addReportAddendum("report-1", { body: "追記します" });

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      "addReportAddendum:user-1",
      RATE_LIMITS.addReportAddendum
    );
    expect(prismaMock.reportAddendum.create).toHaveBeenCalled();
  });
});

describe("createReport（誤と正が同じ投稿を弾く）", () => {
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
    const result = await createReport({ ...baseInput, wrong: "冪等", correct: "冪等" });
    expect(result.error).toBe(IDENTICAL_WRONG_CORRECT_MESSAGE);
    // 弾くべき投稿で DB を触っていないこと（バリデーションは書き込みより手前）
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  // 前後の空白は①画面に現れず②指摘の対象にもなり得ない（紙面の「前後の空白」は観測できない）ので
  // 保存前にトリムする。結果、空白しか違わないものは「同じ」と見なして弾く
  it("前後の空白しか違わないものは同じと見なして弾く", async () => {
    const result = await createReport({ ...baseInput, wrong: " 冪等 ", correct: "冪等" });
    expect(result.error).toBe(IDENTICAL_WRONG_CORRECT_MESSAGE);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  it("値はトリムして保存する（見えない差を残さない）", async () => {
    prismaMock.publisher.upsert.mockResolvedValue({ id: "pub-1" });
    prismaMock.book.upsert.mockResolvedValue({ id: "book-1" });
    prismaMock.report.create.mockResolvedValue({ id: "report-1" });

    await createReport({ ...baseInput, wrong: "  冪等  ", correct: "べき等" });
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

    const result = await createReport({ ...baseInput, wrong: "ＡＰＩ", correct: "API" });
    expect(result.error).toBeUndefined();
    expect(result.id).toBe("report-2");
  });
});

describe("deleteOwnReportImage（投稿者による画像の削除）", () => {
  // 実在しないバケットの URL にしておくと storagePathFromPublicUrl が null を返し、
  // Storage への削除要求そのものが起きない（ここで見たいのは DB 側の判断なので都合がよい）
  const image = {
    id: "image-1",
    reportId: "report-1",
    imageUrl: "https://example.test/not-a-storage-url.png",
    report: { userId: "user-1", status: "PENDING" },
  };

  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "reader@local.test" } } });
    prismaMock.reportImage.findUnique.mockResolvedValue(image);
  });

  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toBe("認証が必要です");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("他人の投稿の画像は削除できない", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-2", status: "PENDING" },
    });

    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toContain("権限がありません");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  // この機能の肝。出版社へ連絡した後に根拠を消せると、本文を凍結していても
  // 「出版社が見た内容」は結局変わってしまう
  it("出版社へ連絡した後は削除できない", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-1", status: "FORWARDED" },
    });

    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toContain("出版社へ連絡した後");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("却下された投稿でも削除できない（PENDING だけが可変）", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-1", status: "DISMISSED" },
    });

    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toContain("出版社へ連絡した後");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("未対応の間は自分の画像を削除でき、操作ログに残る", async () => {
    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.reportImage.delete).toHaveBeenCalledWith({ where: { id: "image-1" } });
    // 消した後に画像があったことを辿れる唯一の手段なので、記録の中身まで見る
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: AUDIT_ACTION.DELETE_OWN_REPORT_IMAGE,
        // 画像は投稿の一部なので、対象は投稿（画像 ID ではない）
        targetId: "report-1",
        before: expect.objectContaining({ imageUrl: image.imageUrl }),
      }),
      expect.anything()
    );
  });

  it("画像が見つからないときは削除もログもしない", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue(null);

    const result = await deleteOwnReportImage("image-1");

    expect(result.error).toBe("画像が見つかりません");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });
});
