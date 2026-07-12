import { describe, it, expect } from "vitest";
import { formatJstDate, shortId } from "@/utils/format";

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

describe("shortId", () => {
  it("UUID の先頭8桁を返す", () => {
    expect(shortId("1034b8a2-0000-4000-8000-000000000000")).toBe("1034b8a2");
  });
});
