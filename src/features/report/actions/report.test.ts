// 投稿の Server Action（features/report/actions/ の7本＝本文の編集・ステータス・賛同・追記・取り下げ・削除）を
// まとめて検査する。投稿の作成は書籍と出版社にまたがるので app にあり、テストも
// app/(site)/submit/create-report.test.ts にある。
//
// ⚠️ **実装を1操作1ファイルに割ってもテストはこの1本にまとめてある。** 先頭の vi.hoisted / vi.mock が
//    50行あり、操作ごとに複製すると「片方だけモックの形が古い」という食い違いが起きる。
//    分けるなら、その足場を共有する形（fixtures ファイル）を先に作ること。
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
    report: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    reportImage: { findUnique: vi.fn(), delete: vi.fn() },
    reportAddendum: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    upvote: { create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「トランザクションの中で使うクライアント（tx）」を渡す。
      // テストでは同じモックを tx として渡すので、トランザクションの中の呼び出しも外と同じ vi.fn() に記録される。
      // ⚠️ 巻き戻りは再現しない。ここで見るのはトランザクションの中身の挙動であって、原子性ではない
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
vi.mock("@/services/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));
// updateReportStatusAction（管理者操作）の検証だけを見たいので、認可・監査ログ・再描画は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { addReportAddendumAction } from "./add-report-addendum";
import { updateReportStatusAction } from "./update-report-status";
import { deleteOwnReportImageAction } from "./delete-own-report-image";
import { deleteReportAction } from "./delete-report";
import { deleteReportAddendumAction } from "./delete-report-addendum";
import { withdrawOwnReportAction } from "./withdraw-own-report";
import { toggleUpvoteAction } from "./toggle-upvote";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { REPORT_LIMITS } from "@/features/report/constants/report-limits";
import { RATE_LIMITS } from "@/constants/rate-limits";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.upvote.count.mockResolvedValue(1);
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("toggleUpvoteAction（賛同を付ける）", () => {
  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ error: "認証が必要です" });
  });

  it("投稿が存在しなければエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue(null);
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ error: "投稿が見つかりません" });
  });

  it("自分の投稿にはエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ error: "自分の投稿には賛同できません" });
    expect(prismaMock.upvote.create).not.toHaveBeenCalled();
  });

  it("他人の投稿への賛同は作成して {upvoted:true, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockResolvedValue({});
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ upvoted: true, count: 1 });
    expect(prismaMock.upvote.create).toHaveBeenCalledWith({
      data: { reportId: "report-1", profileId: "user-2" },
    });
  });

  it("重複賛同（P2002）は冪等に成功扱い", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2002"));
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ upvoted: true, count: 1 });
  });

  it("P2002 以外の DB エラーは汎用エラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2003"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await toggleUpvoteAction("report-1", true);
    expect(result).toEqual({ error: "賛同に失敗しました" });
    consoleSpy.mockRestore();
  });
});

describe("toggleUpvoteAction（賛同を取り消す）", () => {
  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await toggleUpvoteAction("report-1", false);
    expect(result).toEqual({ error: "認証が必要です" });
  });

  it("取り消しは deleteMany（未賛同でも成功）で {upvoted:false, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.upvote.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.upvote.count.mockResolvedValue(0);
    const result = await toggleUpvoteAction("report-1", false);
    expect(result).toEqual({ upvoted: false, count: 0 });
    expect(prismaMock.upvote.deleteMany).toHaveBeenCalledWith({
      where: { reportId: "report-1", profileId: "user-2" },
    });
  });
});

describe("updateReportStatusAction（ステータス更新のバリデーション）", () => {
  it("「その他」は運営者の補足が無いと保存できない（空の OTHER を作らせない）", async () => {
    const result = await updateReportStatusAction("r1", { status: "OTHER", statusNote: "" });

    expect(result.error).toBe("「その他」を選んだときは、運営者の補足欄に事情を記載してください");
    expect(prismaMock.report.update).not.toHaveBeenCalled();
  });

  it("「その他」でも運営者の補足があれば保存できる", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "OTHER" });

    const result = await updateReportStatusAction("r1", {
      status: "OTHER",
      statusNote: "出版社が廃業しており連絡が取れません",
    });

    expect(result.error).toBeUndefined();
    expect(prismaMock.report.update).toHaveBeenCalled();
  });

  it("「その他」以外はコメント無しでも保存できる", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "LISTED" });

    const result = await updateReportStatusAction("r1", { status: "LISTED", statusNote: "" });

    expect(result.error).toBeUndefined();
    expect(prismaMock.report.update).toHaveBeenCalled();
  });

  // 「操作は成立したのに記録だけが無い」状態を作らないための構造を固定する。
  // 巻き戻り自体はモックでは再現できない（実 DB で確認する）ので、ここで見るのは
  // ①トランザクションを張っていること ②監査ログをグローバルの prisma でなく tx で書いていること の2点。
  // ②を落とすと別接続で実行され、トランザクションの外に出て静かに壊れる（services/audit.ts の警告）。
  it("ステータス更新と監査ログは1つのトランザクションの中で書く", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: "r1", status: "PENDING" });
    prismaMock.report.update.mockResolvedValue({ id: "r1", status: "FIXED" });

    await updateReportStatusAction("r1", { status: "FIXED" });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });
});

describe("文字数上限（フォームの maxLength をサーバーでも強制する）", () => {
  // フォームでは maxLength で打ち切られるが、アクション直叩きでは効かないのでサーバー側を検証する

  it("運営者の補足にも上限がある", async () => {
    const result = await updateReportStatusAction("r1", {
      status: "LISTED",
      statusNote: "あ".repeat(REPORT_LIMITS.statusNote + 1),
    });

    expect(result.error).toBe(
      `運営者の補足は${REPORT_LIMITS.statusNote}文字以内で入力してください`
    );
    expect(prismaMock.report.update).not.toHaveBeenCalled();
  });
});

describe("レート制限", () => {

  it("上限に達したら賛同も書き込まない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const result = await toggleUpvoteAction("report-1", true);

    expect(result.error).toContain("操作が多すぎます");
    expect(prismaMock.upvote.create).not.toHaveBeenCalled();
  });

  it("賛同の取り消しも数える（連打は両方向に起きる）", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const result = await toggleUpvoteAction("report-1", false);

    expect(result.error).toContain("操作が多すぎます");
    expect(prismaMock.upvote.deleteMany).not.toHaveBeenCalled();
  });

  // 追記そのものは軽いが、1件ごとに画像の枠を消費できる＝投稿を増やさずに
  // 追記だけ量産する経路を塞ぐのがこの制限
  it("上限に達したら追記を保存しない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 3600 });

    const result = await addReportAddendumAction("report-1", { body: "追記します" });

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

    await addReportAddendumAction("report-1", { body: "追記します" });

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      "addReportAddendum:user-1",
      RATE_LIMITS.addReportAddendum
    );
    expect(prismaMock.reportAddendum.create).toHaveBeenCalled();
  });
});

describe("withdrawOwnReportAction（投稿者による取り下げ）", () => {
  const report = {
    id: "report-1",
    userId: "user-1",
    status: "PENDING",
    title: "誤植の報告",
    // 実在しないバケットの URL＝ storagePathFromPublicUrl が null を返し Storage を触らない
    images: [{ id: "image-1", imageUrl: "https://example.test/not-a-storage-url.png" }],
  };

  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "reader@local.test" } } });
    prismaMock.report.findUnique.mockResolvedValue(report);
  });

  it("未認証はエラー", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await withdrawOwnReportAction("report-1");

    expect(result).toEqual({ error: "認証が必要です" });
    expect(prismaMock.report.delete).not.toHaveBeenCalled();
  });

  it("他人の投稿は取り下げられない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2", email: "other@local.test" } } });

    const result = await withdrawOwnReportAction("report-1");

    expect(result.error).toContain("権限がありません");
    expect(prismaMock.report.delete).not.toHaveBeenCalled();
  });

  it("連絡済みの投稿は取り下げられない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ ...report, status: "FORWARDED" });

    const result = await withdrawOwnReportAction("report-1");

    expect(result.error).toContain("連絡済みの投稿");
    expect(prismaMock.report.delete).not.toHaveBeenCalled();
  });

  it("却下された投稿も取り下げられない（PENDING だけ）", async () => {
    prismaMock.report.findUnique.mockResolvedValue({ ...report, status: "DISMISSED" });

    const result = await withdrawOwnReportAction("report-1");

    expect(result.error).toContain("連絡済みの投稿");
    expect(prismaMock.report.delete).not.toHaveBeenCalled();
  });

  it("投稿が見つからないときは削除もログもしない", async () => {
    prismaMock.report.findUnique.mockResolvedValue(null);

    const result = await withdrawOwnReportAction("report-1");

    expect(result.error).toBe("投稿が見つかりません");
    expect(prismaMock.report.delete).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("未対応の間は取り下げでき、投稿の中身ごと操作ログに残る", async () => {
    // 成功時は redirect が制御フロー例外を投げるので、ここまで来れば削除とログは通っている
    await expect(withdrawOwnReportAction("report-1")).rejects.toThrow("NEXT_REDIRECT");

    expect(prismaMock.report.delete).toHaveBeenCalledWith({ where: { id: "report-1" } });
    // 投稿は物理削除されるので、何が消えたかを辿れるのはこの記録だけ
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: AUDIT_ACTION.WITHDRAW_OWN_REPORT,
        targetType: TARGET_TYPE.REPORT,
        targetId: "report-1",
        before: expect.objectContaining({ title: report.title }),
      }),
      expect.anything()
    );
  });
});

describe("deleteReportAction（運営者による投稿の削除）", () => {
  // 連絡後の投稿には追記と出版社の回答が付きうる。どちらも Cascade で投稿と一緒に消える
  const report = {
    id: "report-1",
    userId: "user-1",
    status: "FORWARDED",
    title: "誤植の報告",
    images: [],
    addenda: [{ id: "addendum-1", body: "追記の本文" }],
    publisherComments: [{ id: "comment-1", body: "回答の本文", publisher: { name: "オーム社" } }],
  };

  it("追記と出版社の回答も、本文ごと操作ログの before に残す", async () => {
    // 1件ずつ消すとき（deleteReportAddendumAction / deletePublisherCommentAction）は本文を残すのに、
    // 投稿ごと消すときだけ何が消えたかを辿れない、という形にしない
    prismaMock.report.findUnique.mockResolvedValue(report);

    // 成功時は redirect が制御フロー例外を投げるので、ここまで来れば削除とログは通っている
    await expect(deleteReportAction("report-1")).rejects.toThrow("NEXT_REDIRECT");

    expect(prismaMock.report.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          addenda: expect.anything(),
          publisherComments: expect.anything(),
        }),
      })
    );
    const [params, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
    expect(params).toMatchObject({ action: AUDIT_ACTION.DELETE_REPORT, targetId: "report-1" });
    expect(params.before).toMatchObject({
      addenda: [{ body: "追記の本文" }],
      publisherComments: [{ body: "回答の本文", publisher: { name: "オーム社" } }],
    });
  });
});

describe("deleteOwnReportImageAction（投稿者による画像の削除）", () => {
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

    const result = await deleteOwnReportImageAction("image-1");

    expect(result.error).toBe("認証が必要です");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("他人の投稿の画像は削除できない", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-2", status: "PENDING" },
    });

    const result = await deleteOwnReportImageAction("image-1");

    expect(result.error).toContain("権限がありません");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  // この機能の肝。出版社へ連絡した後に根拠を消せると、本文を凍結していても
  // 「出版社が見た内容」は結局変わってしまう
  it("連絡済みの投稿は画像を削除できない", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-1", status: "FORWARDED" },
    });

    const result = await deleteOwnReportImageAction("image-1");

    expect(result.error).toContain("連絡済みの投稿");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("却下された投稿でも削除できない（PENDING だけが可変）", async () => {
    prismaMock.reportImage.findUnique.mockResolvedValue({
      ...image,
      report: { userId: "user-1", status: "DISMISSED" },
    });

    const result = await deleteOwnReportImageAction("image-1");

    expect(result.error).toContain("連絡済みの投稿");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
  });

  it("未対応の間は自分の画像を削除でき、操作ログに残る", async () => {
    const result = await deleteOwnReportImageAction("image-1");

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

    const result = await deleteOwnReportImageAction("image-1");

    expect(result.error).toBe("画像が見つかりません");
    expect(prismaMock.reportImage.delete).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });
});

describe("deleteReportAddendumAction（運営者による追記の削除）", () => {
  // 実在しないバケットの URL にしておくと storagePathFromPublicUrl が null を返し、
  // Storage への削除要求そのものが起きない（ここで見たいのは DB 側の判断なので都合がよい）
  const addendum = {
    id: "addendum-1",
    reportId: "report-1",
    body: "追記の本文",
    images: [{ id: "image-1", imageUrl: "https://example.test/not-a-storage-url.png" }],
  };

  it("追記が無ければその旨を返す", async () => {
    prismaMock.reportAddendum.findUnique.mockResolvedValue(null);

    const result = await deleteReportAddendumAction("addendum-1");

    expect(result).toEqual({ error: "追記が見つかりません" });
    expect(prismaMock.reportAddendum.delete).not.toHaveBeenCalled();
  });

  it("削除と監査ログは1つのトランザクションの中で書き、消した中身を before に残す", async () => {
    // before に残すのは、添えていた画像の URL を後から辿れる唯一の手掛かりだから
    // （Storage のファイルは Cascade では消えない = removeImageFiles のコメント）
    prismaMock.reportAddendum.findUnique.mockResolvedValue(addendum);

    const result = await deleteReportAddendumAction("addendum-1");

    expect(result).toEqual({});
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.reportAddendum.delete).toHaveBeenCalledWith({ where: { id: "addendum-1" } });

    const [params, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
    expect(params).toMatchObject({
      action: AUDIT_ACTION.DELETE_REPORT_ADDENDUM,
      targetType: TARGET_TYPE.REPORT,
      // 対象は投稿（追記は投稿の一部）なので追記 ID ではなく投稿 ID
      targetId: "report-1",
    });
    expect(params.before).toMatchObject({ body: "追記の本文" });
  });

  it("添えた画像の URL を、行を消す前に読み出している", async () => {
    // ⚠️ ReportImage は addendumId の Cascade で行だけ消えるので、
    //    先に URL を集めておかないと Storage のファイルが孤児になる
    prismaMock.reportAddendum.findUnique.mockResolvedValue(addendum);

    await deleteReportAddendumAction("addendum-1");

    expect(prismaMock.reportAddendum.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { images: true } })
    );
  });
});
