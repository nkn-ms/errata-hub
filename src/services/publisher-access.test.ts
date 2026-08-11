import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）は実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    report: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { checkPublisherCommentPermission } from "./publisher-access";

const PROFILE_ID = "profile-1";
const REPORT_ID = "report-1";
const PUBLISHER_ID = "publisher-1";

/** 既定は「連絡済みの投稿・出版社あり・権限を持つ一般ユーザー」＝書ける状態 */
beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.report.findUnique.mockResolvedValue({
    status: "FORWARDED",
    book: { publisherId: PUBLISHER_ID },
  });
  prismaMock.profile.findUnique.mockResolvedValue({
    role: "USER",
    publisherAccess: [{ id: "access-1" }],
  });
});

describe("checkPublisherCommentPermission（出版社として回答できるか）", () => {
  it("対象書籍の出版社の権限を持つ人は、本人として書ける", async () => {
    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result).toEqual({ publisherId: PUBLISHER_ID, byAdmin: false });
  });

  it("権限を持たない一般ユーザーは書けない", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ role: "USER", publisherAccess: [] });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result.error).toBe("この投稿に回答する権限がありません。");
    expect(result.publisherId).toBeUndefined();
  });

  it("管理者は権限が無くても書けるが、代理記載になる（規約 第8条4項）", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ role: "ADMIN", publisherAccess: [] });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result).toEqual({ publisherId: PUBLISHER_ID, byAdmin: true });
  });

  it("管理者でも、その出版社の権限を持っていれば本人として書いたことになる", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({
      role: "ADMIN",
      publisherAccess: [{ id: "access-1" }],
    });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result).toEqual({ publisherId: PUBLISHER_ID, byAdmin: false });
  });

  // 未対応の間は投稿者が本文を直せる。ここで回答を許すと「出版社が読んだ内容が
  // 後から書き換わる」＝追記を別テーブルにして避けた問題が回答の側で再発する
  it("未対応（PENDING）の投稿には、権限を持っていても書けない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      status: "PENDING",
      book: { publisherId: PUBLISHER_ID },
    });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result.error).toBe("この投稿はまだ出版社へ連絡していないため、回答できません。");
  });

  it("管理者でも、未対応の投稿には代理記載できない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      status: "PENDING",
      book: { publisherId: PUBLISHER_ID },
    });
    prismaMock.profile.findUnique.mockResolvedValue({ role: "ADMIN", publisherAccess: [] });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result.error).toBe("この投稿はまだ出版社へ連絡していないため、回答できません。");
  });

  // Book.publisherId は nullable。「どの出版社としての発言か」を埋められない
  it("書籍に出版社が登録されていなければ、誰も書けない", async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      status: "FORWARDED",
      book: { publisherId: null },
    });
    prismaMock.profile.findUnique.mockResolvedValue({ role: "ADMIN", publisherAccess: [] });

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result.error).toBe(
      "この投稿の書籍には出版社が登録されていないため、回答できません。"
    );
  });

  it("投稿が無ければ書けない", async () => {
    prismaMock.report.findUnique.mockResolvedValue(null);

    const result = await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(result.error).toBe("投稿が見つかりません");
    expect(prismaMock.profile.findUnique).not.toHaveBeenCalled();
  });

  // 「その出版社の権限を持っているか」を、引いた行の数ではなく where で絞って判定していること。
  // 全件引いて JS 側で探す形にすると、別の出版社の権限で通ってしまう事故が起きうる
  it("権限の照会は対象書籍の出版社に絞って行う", async () => {
    await checkPublisherCommentPermission(PROFILE_ID, REPORT_ID);

    expect(prismaMock.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROFILE_ID },
        select: expect.objectContaining({
          publisherAccess: expect.objectContaining({ where: { publisherId: PUBLISHER_ID } }),
        }),
      })
    );
  });
});
