/**
 * @vitest-environment node
 *
 * Route Handler は undici 由来の Request/Response を扱うので、既定の jsdom だと
 * 別物になって本題の手前で落ちる（同じ理由の詳細は reports/[id]/images/route.test.ts）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, checkRateLimitsMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  checkRateLimitsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimits: checkRateLimitsMock,
  rateLimitKey: (prefix: string, id: string) => `${prefix}:${id}`,
  rateLimitMessage: () => "しばらくしてからお試しください",
}));

import { GET } from "./route";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const request = () => new NextRequest("https://example.test/api/books/search?q=web");

describe("GET /api/books/search の上流リトライ", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "test-key");
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitsMock.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("503 は1回やり直し、2回目が通れば成功として返す", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 503 } }, 503))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "ok" }] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: "ok" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("503 が続いたら 502 を返す（Google の 503 は透過しない）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: 503 } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await GET(request());

    // 503 を透過すると「このサービスが落ちている」の意味になるため 502 に置き換えている
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("403（枠切れ）は再試行しない＝投げ直しても同じ結果になるため", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: 403, message: "Daily Limit Exceeded" } }, 403));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request());

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("タイムアウトは再試行しない（遅い相手に2回待つと待ち時間が倍になる）", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request());

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("通信エラーも1回やり直す", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse({ items: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
