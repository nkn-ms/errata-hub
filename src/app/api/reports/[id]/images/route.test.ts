/**
 * @vitest-environment node
 *
 * 既定の jsdom では `File` / `FormData` が jsdom 由来になり、Route Handler が
 * `request.formData()` から受け取る undici 由来のオブジェクトと別物になる
 * （ルート内の `file instanceof File` が false になり、本題より手前で 400 になる）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Storage への書き込みが済んだ後で DB 行の作成が失敗する経路（＝孤児ファイルができる瞬間）の検証。
// 実接続はしないので prisma と Supabase はモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, checkRateLimitMock, uploadMock, removeMock } = vi.hoisted(() => {
  const models = {
    report: { findUnique: vi.fn() },
    reportAddendum: { findUnique: vi.fn() },
    reportImage: { count: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return {
    prismaMock: {
      ...models,
      // $transaction はコールバックに「塊の中で使うクライアント（tx）」を渡す。
      // 塊の中で投げられた例外はそのまま外へ出る＝ロールバックに相当する扱いにする
      $transaction: vi.fn(async (run: (tx: typeof models) => unknown) => run(models)),
    },
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    uploadMock: vi.fn(),
    removeMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/storage/v1/object/public/report-images/${path}` },
        }),
      }),
    },
  }),
}));
// 同一オリジン検査は Route Handler 自前の CSRF 対策で、ここで見たい分岐より前段にある
vi.mock("@/utils/same-origin", () => ({ isSameOriginRequest: () => true }));

import { POST } from "./route";

const REPORT_ID = "report-1";
const USER_ID = "user-1";

function uploadRequest() {
  const body = new FormData();
  body.set("file", new File(["dummy"], "shot.png", { type: "image/png" }));
  return new Request(`https://example.test/api/reports/${REPORT_ID}/images`, {
    method: "POST",
    body,
  });
}

function callPost(request: Request) {
  return POST(request, { params: Promise.resolve({ id: REPORT_ID }) });
}

describe("POST /api/reports/[id]/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimitMock.mockResolvedValue({ allowed: true });
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    prismaMock.report.findUnique.mockResolvedValue({ id: REPORT_ID, userId: USER_ID });
    prismaMock.reportImage.count.mockResolvedValue(0);
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
  });

  it("行の作成が上限以外の理由で失敗しても、アップロード済みのファイルを消す", async () => {
    // DB 側の障害（接続断・ロック待ちタイムアウト等）を代表させる。
    // これを消さないと、DB 行も監査ログも無い＝どこにも記録の残らない孤児が Storage に残る
    prismaMock.reportImage.create.mockRejectedValue(new Error("db is down"));

    const response = await callPost(uploadRequest());

    expect(response.status).toBe(500);
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock.mock.calls[0][0]).toEqual([expect.stringContaining(`${REPORT_ID}/`)]);
  });

  it("競合で枚数上限に達していたときもアップロード済みのファイルを消す", async () => {
    // 早期チェックは通り、トランザクション内の最終判定で弾かれる（TOCTOU 対策の分岐）
    prismaMock.reportImage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);

    const response = await callPost(uploadRequest());

    expect(response.status).toBe(400);
    expect(prismaMock.reportImage.create).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("成功したときはファイルを消さない", async () => {
    prismaMock.reportImage.create.mockResolvedValue({ id: "image-1", reportId: REPORT_ID });

    const response = await callPost(uploadRequest());

    expect(response.status).toBe(201);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
