import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase・Next のサーバー専用 API はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, signOutMock, deleteUserMock, createAuditLogMock, redirectMock } =
  vi.hoisted(() => ({
    prismaMock: { profile: { update: vi.fn() } },
    getUserMock: vi.fn(),
    signOutMock: vi.fn(),
    deleteUserMock: vi.fn(),
    createAuditLogMock: vi.fn(),
    // 本物の redirect と同じく「投げて制御を打ち切る」挙動を再現する
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock, signOut: signOutMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: deleteUserMock } } }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { withdraw } from "./auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withdraw（退会 = 匿名化）", () => {
  it("未ログインなら /login へリダイレクト", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(withdraw(undefined)).rejects.toThrow("REDIRECT:/login");
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
  });

  it("公開リンク（GitHub / X）を含む全 PII 列をスクラブし、監査ログにも同じ値を残す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleteUserMock.mockResolvedValue({ error: null });
    prismaMock.profile.update.mockResolvedValue({});
    createAuditLogMock.mockResolvedValue(undefined);

    await expect(withdraw(undefined)).rejects.toThrow("REDIRECT:/account/withdrawn");

    // Profile に PII 列を追加したらこの期待値にも追従させること（スクラブ漏れ防止の砦）
    const scrubbed = {
      email: "deleted-user-1@deleted.local",
      displayName: null,
      githubUsername: null,
      xUsername: null,
    };
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: scrubbed,
    });
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WITHDRAW_USER", after: scrubbed })
    );
    expect(signOutMock).toHaveBeenCalled();
  });

  it("auth.users の削除に失敗したら何も変更せずエラーを返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleteUserMock.mockResolvedValue({ error: new Error("boom") });

    const result = await withdraw(undefined);

    expect(result).toEqual({
      error: "退会処理に失敗しました。時間をおいて再度お試しください。",
    });
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
