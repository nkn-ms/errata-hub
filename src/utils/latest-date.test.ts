import { describe, it, expect } from "vitest";
import { latestDate } from "@/utils/latest-date";

const older = new Date("2026-09-01T00:00:00Z");
const newer = new Date("2026-09-20T00:00:00Z");

describe("latestDate", () => {
  it("一番新しい時刻を返す（先頭が古くても）", () => {
    expect(latestDate(older, newer)).toBe(newer);
    expect(latestDate(newer, older)).toBe(newer);
  });

  it("undefined は飛ばす（関連の行が無いとき）", () => {
    expect(latestDate(older, undefined, undefined)).toBe(older);
    expect(latestDate(older, undefined, newer)).toBe(newer);
  });

  it("候補が1つだけならそれを返す", () => {
    expect(latestDate(older)).toBe(older);
  });
});
