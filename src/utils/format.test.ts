import { describe, it, expect } from "vitest";
import { formatJstDate, formatRelativeJst, shortId } from "@/utils/format";

describe("formatJstDate", () => {
  it("JST 基準の YYYY-MM-DD にする", () => {
    expect(formatJstDate(new Date("2026-07-12T01:00:00Z"))).toBe("2026-07-12");
  });

  it("UTC では前日でも JST の日付になる（UTC 15:00 = JST 翌日 00:00）", () => {
    expect(formatJstDate(new Date("2026-07-12T15:00:00Z"))).toBe("2026-07-13");
  });

  it("JST 日付の境界直前は当日のまま（UTC 14:59 = JST 23:59）", () => {
    expect(formatJstDate(new Date("2026-07-12T14:59:59Z"))).toBe("2026-07-12");
  });
});

describe("formatRelativeJst", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("1分未満は『たった今』", () => {
    expect(formatRelativeJst("2026-07-23T11:59:30Z", now)).toBe("たった今");
  });

  it("未来（時計ずれ）も『たった今』に寄せる", () => {
    expect(formatRelativeJst("2026-07-23T12:05:00Z", now)).toBe("たった今");
  });

  it("分・時間・日で表す", () => {
    expect(formatRelativeJst("2026-07-23T11:30:00Z", now)).toBe("30分前");
    expect(formatRelativeJst("2026-07-23T09:00:00Z", now)).toBe("3時間前");
    expect(formatRelativeJst("2026-07-20T12:00:00Z", now)).toBe("3日前");
  });

  it("24〜48時間前は『昨日』", () => {
    expect(formatRelativeJst("2026-07-22T10:00:00Z", now)).toBe("昨日");
  });

  it("7日以上前は JST の絶対日付にフォールバックする", () => {
    expect(formatRelativeJst("2026-07-10T00:00:00Z", now)).toBe("2026-07-10");
  });
});

describe("shortId", () => {
  it("UUID の先頭8桁を返す", () => {
    expect(shortId("1034b8a2-0000-4000-8000-000000000000")).toBe("1034b8a2");
  });
});
