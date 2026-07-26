import { describe, it, expect, vi, beforeEach } from "vitest";

// prisma 本体（pg アダプタ）は実接続するのでモックする。
// SQL 自体が Postgres で意図どおり動くこと（原子的な加算・窓の切り替え）は
// ローカル実DBで別途確認済み（並列20発で allowed=5 / count=20 = 数え落とし無し）。
// ここで担保するのは TypeScript 側の判定ロジック。
const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRawMock } }));

import {
  checkRateLimit,
  checkRateLimits,
  formatRetryAfter,
  rateLimitKey,
  rateLimitMessage,
  windowStartFor,
} from "./rate-limit";

/** SQL が返す「加算後の値」を模す */
function respondWithCount(count: number) {
  queryRawMock.mockResolvedValueOnce([{ count }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("windowStartFor（固定窓の開始時刻）", () => {
  it("窓幅で切り捨てるので、同じ窓の時刻は同じ開始時刻に丸まる", () => {
    const hour = 60 * 60;
    const a = windowStartFor(new Date("2026-07-27T10:00:00.000Z"), hour);
    const b = windowStartFor(new Date("2026-07-27T10:59:59.999Z"), hour);
    expect(a.toISOString()).toBe("2026-07-27T10:00:00.000Z");
    expect(b.toISOString()).toBe(a.toISOString());
  });

  it("窓をまたぐと別の開始時刻になる", () => {
    const hour = 60 * 60;
    const before = windowStartFor(new Date("2026-07-27T10:59:59.999Z"), hour);
    const after = windowStartFor(new Date("2026-07-27T11:00:00.000Z"), hour);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
    expect(after.toISOString()).toBe("2026-07-27T11:00:00.000Z");
  });

  it("1日窓は UTC の日境界に丸まる（86400 秒の倍数で切るため）", () => {
    const day = 24 * 60 * 60;
    expect(windowStartFor(new Date("2026-07-27T23:59:00.000Z"), day).toISOString())
      .toBe("2026-07-27T00:00:00.000Z");
  });
});

describe("checkRateLimit（1回消費して上限内かを返す）", () => {
  const rule = { limit: 3, windowSec: 60 };
  const now = new Date("2026-07-27T10:00:30.000Z");

  it("上限ちょうどまでは許可する", async () => {
    respondWithCount(3);
    await expect(checkRateLimit("k", rule, now)).resolves.toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });

  it("上限を1つ超えたら拒否する", async () => {
    respondWithCount(4);
    const result = await checkRateLimit("k", rule, now);
    expect(result.allowed).toBe(false);
  });

  it("拒否時の retryAfter は窓の終わりまでの残り秒数", async () => {
    respondWithCount(4);
    // 10:00:30 は 10:00:00 始まりの60秒窓の中なので、残りは 30 秒
    const result = await checkRateLimit("k", rule, now);
    expect(result.retryAfterSec).toBe(30);
  });

  it("窓の終わり際でも retryAfter は 0 にならない（即再試行させない）", async () => {
    respondWithCount(4);
    const result = await checkRateLimit("k", rule, new Date("2026-07-27T10:00:59.999Z"));
    expect(result.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("窓の開始時刻を SQL に渡している（同じ窓が同じ行に集まる根拠）", async () => {
    respondWithCount(1);
    await checkRateLimit("k", rule, now);
    const params = queryRawMock.mock.calls[0].slice(1);
    expect(params).toContainEqual(new Date("2026-07-27T10:00:00.000Z"));
  });

  it("DB が落ちていたら通す（fail open）", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection refused"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(checkRateLimit("k", rule, now)).resolves.toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("checkRateLimits（複数の窓を同時に見る）", () => {
  const perMinute = { limit: 30, windowSec: 60 };
  const perDay = { limit: 300, windowSec: 24 * 60 * 60 };
  const keys = [
    { key: "min", rule: perMinute },
    { key: "day", rule: perDay },
  ];
  const now = new Date("2026-07-27T10:00:30.000Z");

  it("どちらも上限内なら許可", async () => {
    respondWithCount(10);
    respondWithCount(100);
    await expect(checkRateLimits(keys, now)).resolves.toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });

  it("片方でも超えていたら拒否", async () => {
    respondWithCount(31);
    respondWithCount(100);
    const result = await checkRateLimits(keys, now);
    expect(result.allowed).toBe(false);
  });

  it("両方超えていたら長い方の retryAfter を返す", async () => {
    respondWithCount(31);
    respondWithCount(301);
    const result = await checkRateLimits(keys, now);
    // 分の窓の残り 30 秒より、日の窓の残り（約14時間）の方が長い
    expect(result.retryAfterSec).toBeGreaterThan(60);
  });

  it("拒否されても全ての窓を消費する（短絡評価しない）", async () => {
    respondWithCount(31);
    respondWithCount(100);
    await checkRateLimits(keys, now);
    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });
});

describe("rateLimitKey", () => {
  it("動作ごとに独立して数えられるよう動作名を前置する", () => {
    expect(rateLimitKey("createReport", "user-1")).toBe("createReport:user-1");
    expect(rateLimitKey("toggleUpvote", "user-1")).not.toBe(
      rateLimitKey("createReport", "user-1")
    );
  });
});

describe("formatRetryAfter / rateLimitMessage", () => {
  it("秒・分・時間で単位を切り替える", () => {
    expect(formatRetryAfter(30)).toBe("30秒");
    expect(formatRetryAfter(90)).toBe("2分");
    expect(formatRetryAfter(60 * 60 * 5)).toBe("5時間");
  });

  it("1日窓の残り時間が「86400秒」のような読めない表示にならない", () => {
    expect(rateLimitMessage(86400)).toContain("24時間");
    expect(rateLimitMessage(86400)).not.toContain("86400");
  });
});
