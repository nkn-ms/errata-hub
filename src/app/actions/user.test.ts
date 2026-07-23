import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, scrubMock, createAuditLogMock } = vi.hoisted(() => ({
  prismaMock: { profile: { findUnique: vi.fn() } },
  scrubMock: vi.fn(),
  createAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// 代行退会のガードだけを見たいので、認可・監査ログ・再描画は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminOrThrow: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/withdrawal", () => ({ scrubProfileForWithdrawal: scrubMock }));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { withdrawUserAsAdmin } from "./user";

const TARGET_ID = "user-1";
const target = {
  id: TARGET_ID,
  email: "reader@local.test",
  displayName: "reader",
  role: "USER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.profile.findUnique.mockResolvedValue(target);
  scrubMock.mockResolvedValue({
    ok: true,
    scrubbed: {
      email: `deleted-${TARGET_ID}@deleted.local`,
      displayName: null,
      githubUsername: null,
      xUsername: null,
    },
  });
});

describe("withdrawUserAsAdmin（管理者による代行退会）", () => {
  it("表示名を正しく入力すると退会処理と監査ログが走る", async () => {
    const result = await withdrawUserAsAdmin(TARGET_ID, "reader");

    expect(result).toEqual({});
    expect(scrubMock).toHaveBeenCalledWith(TARGET_ID);
    // 実行した管理者は残すが、対象の元メール・元表示名は残さない（PII を無期限保持しない）
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        userEmail: "admin@local.test",
        action: "ADMIN_WITHDRAW_USER",
        targetId: TARGET_ID,
        after: expect.objectContaining({ displayName: null, githubUsername: null, xUsername: null }),
      })
    );
    const logged = createAuditLogMock.mock.calls[0][0];
    expect(JSON.stringify(logged)).not.toContain("reader@local.test");
  });

  it("表示名が一致しなければ何もしない（押し間違いの砦・サーバー側でも照合する）", async () => {
    const result = await withdrawUserAsAdmin(TARGET_ID, "reade");

    expect(result.error).toBe("確認のため、表示された名前をそのまま入力してください");
    expect(scrubMock).not.toHaveBeenCalled();
  });

  it("表示名が null のユーザーはメールアドレスでの確認になる", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ ...target, displayName: null });

    expect((await withdrawUserAsAdmin(TARGET_ID, "reader")).error).toBeDefined();
    expect(await withdrawUserAsAdmin(TARGET_ID, "reader@local.test")).toEqual({});
  });

  it("自分自身は退会させられない（対象を読む前に止める）", async () => {
    const result = await withdrawUserAsAdmin("admin-1", "admin@local.test");

    expect(result.error).toBe("自分自身を退会させることはできません");
    expect(prismaMock.profile.findUnique).not.toHaveBeenCalled();
    expect(scrubMock).not.toHaveBeenCalled();
  });

  it("ADMIN ロールは退会させられない（先にロールを落とさせる）", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({ ...target, role: "ADMIN" });

    const result = await withdrawUserAsAdmin(TARGET_ID, "reader");

    expect(result.error).toContain("管理者は退会させられません");
    expect(scrubMock).not.toHaveBeenCalled();
  });

  it("既に退会済みのユーザーには何もしない", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({
      ...target,
      email: `deleted-${TARGET_ID}@deleted.local`,
      displayName: null,
    });

    const result = await withdrawUserAsAdmin(TARGET_ID, `deleted-${TARGET_ID}@deleted.local`);

    expect(result.error).toBe("このユーザーは既に退会済みです");
    expect(scrubMock).not.toHaveBeenCalled();
  });

  it("存在しないユーザーには何もしない", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(null);

    const result = await withdrawUserAsAdmin(TARGET_ID, "reader");

    expect(result.error).toBe("ユーザーが見つかりません");
    expect(scrubMock).not.toHaveBeenCalled();
  });

  it("auth.users の削除に失敗したら監査ログを残さない", async () => {
    scrubMock.mockResolvedValue({ ok: false, reason: "auth-delete-failed" });

    const result = await withdrawUserAsAdmin(TARGET_ID, "reader");

    expect(result.error).toContain("退会処理に失敗しました");
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });
});
