import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, scrubMock, authUserExistsMock, createAuditLogMock } = vi.hoisted(() => {
  const models = {
    profile: { findUnique: vi.fn(), update: vi.fn() },
    publisher: { findUnique: vi.fn() },
    publisherAccess: { create: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに tx を渡す。テストでは同じモックを渡すので、
      // 塊の中の呼び出しも外と同じ vi.fn() に記録される（巻き戻りは再現しない）。
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    scrubMock: vi.fn(),
    authUserExistsMock: vi.fn(),
    createAuditLogMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// 代行退会のガードだけを見たいので、認可・監査ログ・再描画は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/withdrawal", () => ({
  scrubProfileForWithdrawal: scrubMock,
  authUserExists: authUserExistsMock,
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import {
  withdrawUserAsAdmin,
  updateUserRole,
  grantPublisherAccess,
  revokePublisherAccess,
} from "./user";

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
  // 既定は「auth.users は残っていない」＝退会は完了している
  authUserExistsMock.mockResolvedValue(false);
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

  // 補償に失敗して途中で止まった退会（Profile はスクラブ済みだが auth.users が残っている）は、
  // ここから完了させられる必要がある＝取り残しを回収する管理者側の経路
  it("スクラブ済みでも auth.users が残っていれば完了させられる", async () => {
    prismaMock.profile.findUnique.mockResolvedValue({
      ...target,
      email: `deleted-${TARGET_ID}@deleted.local`,
      displayName: null,
    });
    authUserExistsMock.mockResolvedValue(true);

    const result = await withdrawUserAsAdmin(TARGET_ID, `deleted-${TARGET_ID}@deleted.local`);

    expect(result).toEqual({});
    expect(scrubMock).toHaveBeenCalledWith(TARGET_ID);
  });

  // 二重の失敗で退会が途中のまま残ったときは、誰も気づけないので記録して発見できるようにする
  it("退会が未完了で残ったら監査ログに残す", async () => {
    scrubMock.mockResolvedValue({ ok: false, reason: "withdrawal-incomplete" });

    const result = await withdrawUserAsAdmin(TARGET_ID, "reader");

    expect(result.error).toContain("退会処理に失敗しました");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WITHDRAWAL_INCOMPLETE", targetId: TARGET_ID })
    );
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

const PUBLISHER_ID = "11111111-2222-4333-8444-555555555555";

describe("updateUserRole（ロール変更）", () => {
  beforeEach(() => {
    prismaMock.profile.update.mockResolvedValue({ ...target, role: "ADMIN" });
  });

  // Role は identity（ADMIN/USER）の2値。出版社かどうかは PublisherAccess から導出する
  it("知らないロールは弾く", async () => {
    const result = await updateUserRole(TARGET_ID, "PUBLISHER");

    expect(result.error).toBeDefined();
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
  });

  // ロールを減らせる操作はこれだけなので、自己降格を塞げば「誰かは必ず ADMIN」が保たれる。
  // 管理者が0人になるとアプリからは誰も戻せず、DB を直接触るしかなくなる＝取り返しがつかない
  it("自分自身のロールは変更できない（管理者0人を構造的に防ぐ）", async () => {
    const result = await updateUserRole("admin-1", "USER");

    expect(result.error).toContain("自分自身のロールは変更できません");
    expect(prismaMock.profile.update).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("ADMIN へ昇格できる", async () => {
    const result = await updateUserRole(TARGET_ID, "ADMIN");

    expect(result.error).toBeUndefined();
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { role: "ADMIN" },
    });
  });

  // 行に残るのは現在のロールだけなので、誰が昇格させたかは監査ログにしか残らない（PR#168）
  it("変更と監査ログは1つの塊の中で書き、変更前後を残す", async () => {
    await updateUserRole(TARGET_ID, "ADMIN");

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [params, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
    expect(params).toMatchObject({
      action: "UPDATE_USER_ROLE",
      userId: "admin-1",
      before: { role: "USER" },
      after: { role: "ADMIN" },
    });
  });
});

describe("grantPublisherAccess（出版社アクセスの付与）", () => {
  beforeEach(() => {
    prismaMock.publisherAccess.create.mockResolvedValue({
      id: "access-1",
      publisher: { id: PUBLISHER_ID, name: "オーム社" },
      profile: { email: "reader@local.test" },
    });
  });

  it("出版社の指定が UUID でなければ弾く", async () => {
    const result = await grantPublisherAccess(TARGET_ID, "not-a-uuid");

    expect(result.error).toBe("出版社の指定が不正です");
    expect(prismaMock.publisherAccess.create).not.toHaveBeenCalled();
  });

  // 「なぜこの人が権限を持つのか」を出版社の画面から説明できるように出所を行に持たせる（PR#162）。
  // メールも控えるのは、付与した管理者が後に退会しても記録が読めるようにするため
  it("付与の出所（誰が付けたか）を行に残す", async () => {
    await grantPublisherAccess(TARGET_ID, PUBLISHER_ID);

    expect(prismaMock.publisherAccess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: TARGET_ID,
          publisherId: PUBLISHER_ID,
          grantedById: "admin-1",
          grantedByEmail: "admin@local.test",
        }),
      })
    );
  });

  it("付与と監査ログは1つの塊の中で書く", async () => {
    const result = await grantPublisherAccess(TARGET_ID, PUBLISHER_ID);

    expect(result.access).toBeDefined();
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
  });

  // ⚠️ userEmail は**操作した管理者**。誰に付与したかは targetId の UUID しか無く、
  //    後から DB で名寄せしないと読めなかった（対象者が退会・削除されると辿れない）
  it("誰に付与したかを記録に残す（当時のメール）", async () => {
    await grantPublisherAccess(TARGET_ID, PUBLISHER_ID);

    const [params] = createAuditLogMock.mock.calls[0];
    expect(params).toMatchObject({
      userEmail: "admin@local.test",
      targetId: TARGET_ID,
      after: { targetEmail: "reader@local.test", publisherName: "オーム社" },
    });
  });
});

describe("revokePublisherAccess（出版社アクセスの剥奪）", () => {
  it("出版社の指定が UUID でなければ弾く（付与側と揃える）", async () => {
    const result = await revokePublisherAccess(TARGET_ID, "not-a-uuid");

    expect(result.error).toBe("出版社の指定が不正です");
    expect(prismaMock.publisherAccess.deleteMany).not.toHaveBeenCalled();
  });

  // deleteMany は対象が無くても成功する。0件のまま記録すると
  // 「剥奪した」という起きていない操作の行が監査ログに残ってしまう
  it("剥奪する権限が無ければ監査ログを書かずエラーを返す", async () => {
    prismaMock.publisher.findUnique.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
    prismaMock.publisherAccess.deleteMany.mockResolvedValue({ count: 0 });

    const result = await revokePublisherAccess(TARGET_ID, PUBLISHER_ID);

    expect(result.error).toContain("アクセス権を持っていません");
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("実際に剥奪できたときだけ、監査ログを同じ塊の中でどの出版社かまで残す", async () => {
    prismaMock.publisher.findUnique.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
    prismaMock.profile.findUnique.mockResolvedValue({ email: "reader@local.test" });
    prismaMock.publisherAccess.deleteMany.mockResolvedValue({ count: 1 });

    const result = await revokePublisherAccess(TARGET_ID, PUBLISHER_ID);

    expect(result.error).toBeUndefined();
    expect(prismaMock.publisherAccess.deleteMany).toHaveBeenCalledWith({
      where: { profileId: TARGET_ID, publisherId: PUBLISHER_ID },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const [params, tx] = createAuditLogMock.mock.calls[0];
    expect(tx).toBeDefined();
    expect(params).toMatchObject({
      action: "REVOKE_PUBLISHER_ACCESS",
      // 誰から剥奪したかも残す（付与側と対称）
      before: {
        targetEmail: "reader@local.test",
        publisherId: PUBLISHER_ID,
        publisherName: "オーム社",
      },
    });
  });
});
