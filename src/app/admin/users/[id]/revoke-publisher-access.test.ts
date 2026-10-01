import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, createAuditLogMock } = vi.hoisted(() => {
  const models = {
    profile: { findUnique: vi.fn() },
    publisher: { findUnique: vi.fn() },
    publisherAccess: { deleteMany: vi.fn() },
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「トランザクションの中で使うクライアント（tx）」を渡す。
      // テストでは同じモックを tx として渡すので、トランザクションの中の呼び出しも外と同じ vi.fn() に記録される。
      // ⚠️ 巻き戻りは再現しない（原子性はローカル実 DB で確認する = PR#168）。
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    createAuditLogMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// 管理者操作の中身だけを見たいので、認可・監査ログ・再描画・遷移は素通りさせる
vi.mock("@/services/auth", () => ({
  requireAdminServerAction: async () => ({ id: "admin-1", email: "admin@local.test" }),
}));
vi.mock("@/services/audit", () => ({ createAuditLog: createAuditLogMock }));

import { revokePublisherAccessAction } from "./revoke-publisher-access";

const TARGET_ID = "user-1";
const PUBLISHER_ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revokePublisherAccessAction（出版社アクセスの剥奪）", () => {
  it("出版社の指定が UUID でなければ弾く（付与側と揃える）", async () => {
    const result = await revokePublisherAccessAction(TARGET_ID, "not-a-uuid");

    expect(result.error).toBe("出版社の指定が不正です");
    expect(prismaMock.publisherAccess.deleteMany).not.toHaveBeenCalled();
  });

  // deleteMany は対象が無くても成功する。0件のまま記録すると
  // 「剥奪した」という起きていない操作の行が監査ログに残ってしまう
  it("剥奪する権限が無ければ監査ログを書かずエラーを返す", async () => {
    prismaMock.publisher.findUnique.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
    prismaMock.publisherAccess.deleteMany.mockResolvedValue({ count: 0 });

    const result = await revokePublisherAccessAction(TARGET_ID, PUBLISHER_ID);

    expect(result.error).toContain("アクセス権を持っていません");
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("実際に剥奪できたときだけ、監査ログを同じトランザクションの中でどの出版社かまで残す", async () => {
    prismaMock.publisher.findUnique.mockResolvedValue({ id: PUBLISHER_ID, name: "オーム社" });
    prismaMock.profile.findUnique.mockResolvedValue({ email: "reader@local.test" });
    prismaMock.publisherAccess.deleteMany.mockResolvedValue({ count: 1 });

    const result = await revokePublisherAccessAction(TARGET_ID, PUBLISHER_ID);

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
