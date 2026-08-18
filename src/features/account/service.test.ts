import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, deleteUserMock, getUserByIdMock } = vi.hoisted(() => ({
  prismaMock: { profile: { findUnique: vi.fn(), update: vi.fn() } },
  deleteUserMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: deleteUserMock, getUserById: getUserByIdMock } },
  }),
}));

import { scrubProfileForWithdrawal, authUserExists } from "./service";

const PROFILE_ID = "user-1";
const original = {
  email: "reader@local.test",
  displayName: "reader",
  githubUsername: "reader-gh",
  xUsername: "reader_x",
};
const scrubbed = {
  email: `deleted-${PROFILE_ID}@deleted.local`,
  displayName: null,
  githubUsername: null,
  xUsername: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.profile.findUnique.mockResolvedValue(original);
  prismaMock.profile.update.mockResolvedValue({});
  deleteUserMock.mockResolvedValue({ error: null });
});

describe("scrubProfileForWithdrawal（退会の実体）", () => {
  it("対象の Profile が無ければ何もしない", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(null);

    const result = await scrubProfileForWithdrawal(PROFILE_ID);

    expect(result).toEqual({ ok: false, reason: "profile-not-found" });
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("成功すると PII をスクラブして auth.users を消す", async () => {
    const result = await scrubProfileForWithdrawal(PROFILE_ID);

    expect(result).toEqual({ ok: true, scrubbed });
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: scrubbed,
    });
    expect(deleteUserMock).toHaveBeenCalledWith(PROFILE_ID);
  });

  // ⭐ この順序が設計の要。取り消せない操作（auth.users の削除）を最後に置くことで、
  //    その手前までは巻き戻せる＝「auth が消えて PII だけ残る」回復不能な状態が生まれない
  it("取り消せない auth.users の削除は、スクラブより後に行う", async () => {
    await scrubProfileForWithdrawal(PROFILE_ID);

    const scrubOrder = prismaMock.profile.update.mock.invocationCallOrder[0];
    const deleteOrder = deleteUserMock.mock.invocationCallOrder[0];
    expect(scrubOrder).toBeLessThan(deleteOrder);
  });

  it("auth.users を消せなければスクラブを書き戻す（呼び出し側から見て何も起きていない）", async () => {
    deleteUserMock.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });

    const result = await scrubProfileForWithdrawal(PROFILE_ID);

    expect(result).toEqual({ ok: false, reason: "auth-delete-failed" });
    // 2回目の update が書き戻し。元の値がそのまま戻る
    expect(prismaMock.profile.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.profile.update).toHaveBeenLastCalledWith({
      where: { id: PROFILE_ID },
      data: original,
    });
  });

  // 前回の試行で auth.users まで消えていた場合。ここを失敗にするとリトライが永遠に収束しない
  it("auth.users が既に無いときは成功扱いにする（リトライが完了できる）", async () => {
    deleteUserMock.mockResolvedValue({ error: { code: "user_not_found", status: 404 } });

    const result = await scrubProfileForWithdrawal(PROFILE_ID);

    expect(result).toEqual({ ok: true, scrubbed });
    // 書き戻さない（スクラブしたまま完了させる）
    expect(prismaMock.profile.update).toHaveBeenCalledTimes(1);
  });

  it("code が無くても 404 なら既に無いと判断する", async () => {
    deleteUserMock.mockResolvedValue({ error: { status: 404 } });

    expect(await scrubProfileForWithdrawal(PROFILE_ID)).toEqual({ ok: true, scrubbed });
  });

  // 二重の失敗。当初の目的にはまだ到達できるが、放置されないよう呼び出し側に記録させる
  it("書き戻しにも失敗したら withdrawal-incomplete を返す", async () => {
    deleteUserMock.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    prismaMock.profile.update
      .mockResolvedValueOnce({}) // スクラブは成功
      .mockRejectedValueOnce(new Error("書き戻し失敗"));

    const result = await scrubProfileForWithdrawal(PROFILE_ID);

    expect(result).toEqual({ ok: false, reason: "withdrawal-incomplete" });
  });
});

describe("authUserExists（退会が途中で止まっていないかの判定）", () => {
  it("auth.users に行があれば true", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: { id: PROFILE_ID } }, error: null });

    expect(await authUserExists(PROFILE_ID)).toBe(true);
  });

  it("対象が無ければ false（＝退会は完了している）", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } });

    expect(await authUserExists(PROFILE_ID)).toBe(false);
  });

  // 分からないときに false を返すと「退会済み扱い」で止まり、未完了のものを取りこぼす
  it("判定できないときは true に倒す（完了させる道を塞がない）", async () => {
    getUserByIdMock.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", status: 500 },
    });

    expect(await authUserExists(PROFILE_ID)).toBe(true);
  });
});
