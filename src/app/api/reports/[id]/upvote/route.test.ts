import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）と Supabase はテストでは実接続しないためモックする。
// vi.mock はファイル先頭へ巻き上げられるため、参照する値は vi.hoisted で先に定義する。
const { prismaMock, getUserMock, PrismaClientKnownRequestError } = vi.hoisted(() => {
  // ルートは Prisma.PrismaClientKnownRequestError の instanceof + code 判定に使う
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    prismaMock: {
      report: { findUnique: vi.fn() },
      upvote: { create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    },
    getUserMock: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));

import { POST, DELETE } from "./route";

const params = Promise.resolve({ id: "report-1" });
const req = new Request("http://localhost/api/reports/report-1/upvote");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.upvote.count.mockResolvedValue(1);
});

describe("POST /api/reports/[id]/upvote", () => {
  it("未認証は 401", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("投稿が存在しなければ 404", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue(null);
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it("自分の投稿には 403", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(prismaMock.upvote.create).not.toHaveBeenCalled();
  });

  it("他人の投稿への賛同は作成して {upvoted:true, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockResolvedValue({});
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ upvoted: true, count: 1 });
    expect(prismaMock.upvote.create).toHaveBeenCalledWith({
      data: { reportId: "report-1", profileId: "user-2" },
    });
  });

  it("重複賛同（P2002）は冪等に成功扱い", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2002"));
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ upvoted: true, count: 1 });
  });

  it("P2002 以外の DB エラーは 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.report.findUnique.mockResolvedValue({ userId: "user-1" });
    prismaMock.upvote.create.mockRejectedValue(new PrismaClientKnownRequestError("P2003"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});

describe("DELETE /api/reports/[id]/upvote", () => {
  it("未認証は 401", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req, { params });
    expect(res.status).toBe(401);
  });

  it("取り消しは deleteMany（未賛同でも成功）で {upvoted:false, count} を返す", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } });
    prismaMock.upvote.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.upvote.count.mockResolvedValue(0);
    const res = await DELETE(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ upvoted: false, count: 0 });
    expect(prismaMock.upvote.deleteMany).toHaveBeenCalledWith({
      where: { reportId: "report-1", profileId: "user-2" },
    });
  });
});
