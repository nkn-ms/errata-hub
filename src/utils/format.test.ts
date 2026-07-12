import { describe, it, expect } from "vitest";
import { formatUtcDate, shortId } from "@/utils/format";

describe("formatUtcDate", () => {
  it("YYYY-MM-DD 形式にする", () => {
    expect(formatUtcDate(new Date("2026-07-12T10:30:00Z"))).toBe("2026-07-12");
  });

  it("UTC 基準なので JST 早朝（UTC では前日）は前日の日付になる", () => {
    // JST 2026-07-13 08:59 = UTC 2026-07-12 23:59
    expect(formatUtcDate(new Date("2026-07-12T23:59:00Z"))).toBe("2026-07-12");
  });
});

describe("shortId", () => {
  it("UUID の先頭8桁を返す", () => {
    expect(shortId("1034b8a2-0000-4000-8000-000000000000")).toBe("1034b8a2");
  });
});
