/**
 * @vitest-environment node
 *
 * Route Handler は undici 由来の Request/Response を扱うので、既定の jsdom だと
 * 別物になって本題の手前で落ちる（同じ理由の詳細は reports/[id]/images/route.test.ts）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, checkRateLimitMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: (prefix: string, id: string) => `${prefix}:${id}`,
  rateLimitMessage: () => "しばらくしてからお試しください",
}));

import { GET } from "./route";

const VALID_ISBN = "9784873116860";
const request = (isbn: string) =>
  new NextRequest(`https://example.test/api/books/openbd?isbn=${isbn}`);

describe("GET /api/books/openbd の失敗と「該当なし」の区別", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkRateLimitMock.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("上流の失敗は 502 にする（空配列にすると ISBN 検索が「入力ミス」として表示してしまう）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request(VALID_ISBN));

    expect(res.status).toBe(502);
  });

  it("通信エラーも 502 にする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request(VALID_ISBN));

    expect(res.status).toBe(502);
  });

  it("上流が「該当なし」を返したときは 200 の空配列のまま（失敗ではない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([null]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const res = await GET(request(VALID_ISBN));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([null]);
  });

  it("ISBN の形が不正なら上流を叩かずに空配列を返す", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(request("not-an-isbn"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
