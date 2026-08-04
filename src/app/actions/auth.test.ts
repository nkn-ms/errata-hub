import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase・Next のサーバー専用 API はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, signOutMock, deleteUserMock, createAuditLogMock, redirectMock } =
  vi.hoisted(() => ({
    prismaMock: { profile: { findUnique: vi.fn(), update: vi.fn() } },
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

const ORIGINAL_PII = {
  email: "reader@local.test",
  displayName: "reader",
  githubUsername: "reader-gh",
  xUsername: "reader_x",
};

beforeEach(() => {
  vi.clearAllMocks();
  // withdraw は Profile を用途違いで2回読むので、select で返す値を振り分ける。
  //   role → 管理者は退会できない規則の判定（既定は一般ユーザー＝規則を踏まない）
  //   PII  → auth.users の削除に失敗したときの書き戻しに使う退会前の値
  prismaMock.profile.findUnique.mockImplementation(async ({ select }) =>
    select.role ? { role: "USER" } : ORIGINAL_PII
  );
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

  // 代行退会（withdrawUserAsAdmin）には昔からある規則だが、本人退会側には無く、
  // 最後の管理者が自分で消えられる穴になっていた（管理者0人＝アプリからは戻せない）
  it("管理者は退会できない（先にロールを変更してもらう）", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.profile.findUnique.mockResolvedValue({ role: "ADMIN" });

    const result = await withdraw(undefined);

    expect(result?.error).toContain("管理者アカウントは退会できません");
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
  });

  // 取り消せない auth.users の削除を最後に置いたので、失敗しても書き戻して
  // 「何も起きていない」状態に戻せる＝文言どおり本人が再試行できる
  it("auth.users の削除に失敗したらスクラブを書き戻し、退会は成立させない", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleteUserMock.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    prismaMock.profile.update.mockResolvedValue({});

    const result = await withdraw(undefined);

    expect(result).toEqual({
      error: "退会処理に失敗しました。時間をおいて再度お試しください。",
    });
    // スクラブ→書き戻しの2回。最後に元の値へ戻っている
    expect(prismaMock.profile.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.profile.update).toHaveBeenLastCalledWith({
      where: { id: "user-1" },
      data: ORIGINAL_PII,
    });
    expect(createAuditLogMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  // 書き戻しにも失敗した二重の事故。放置されないよう記録する（発見は /admin/logs）
  it("書き戻しにも失敗したら未完了として監査ログに残す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleteUserMock.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    prismaMock.profile.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("書き戻し失敗"));

    const result = await withdraw(undefined);

    expect(result?.error).toContain("退会処理に失敗しました");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WITHDRAWAL_INCOMPLETE", targetId: "user-1" })
    );
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
