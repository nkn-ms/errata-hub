import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_TOOLTIPS,
} from "@/constants/report-status";

const STATUS_KEYS = Object.keys(STATUS_LABELS);

describe("report-status の定義", () => {
  it("全ステータスにラベル・色・ツールチップが揃っている", () => {
    for (const key of STATUS_KEYS) {
      expect(STATUS_LABELS[key as keyof typeof STATUS_LABELS]).toBeTruthy();
      expect(STATUS_COLORS[key as keyof typeof STATUS_COLORS]).toBeTruthy();
      expect(STATUS_TOOLTIPS[key as keyof typeof STATUS_TOOLTIPS]).toBeTruthy();
    }
  });

  it("ラベルに重複がない", () => {
    const labels = Object.values(STATUS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("既知のラベルが期待どおり", () => {
    expect(STATUS_LABELS.PENDING).toBe("未対応");
    expect(STATUS_LABELS.FORWARDED).toBe("出版社へ連絡済み");
    expect(STATUS_LABELS.LISTED).toBe("正誤表に掲載");
    expect(STATUS_LABELS.FIXED).toBe("修正済み");
    expect(STATUS_LABELS.WONT_FIX).toBe("修正なし");
    expect(STATUS_LABELS.DISMISSED).toBe("却下");
    expect(STATUS_LABELS.OTHER).toBe("その他");
  });

  it("統合で消した3値は復活していない（IN_REVIEW / REPLIED / NO_ACTION）", () => {
    expect(STATUS_KEYS).not.toContain("IN_REVIEW");
    expect(STATUS_KEYS).not.toContain("REPLIED");
    expect(STATUS_KEYS).not.toContain("NO_ACTION");
  });

  it("進行順に並んでいる（管理画面のボタン列と /how-to-use の説明はこの順で出る）", () => {
    expect(STATUS_KEYS).toEqual([
      "PENDING",
      "FORWARDED",
      "LISTED",
      "WILL_FIX",
      "FIXED",
      "WONT_FIX",
      "DISMISSED",
      "OTHER",
    ]);
  });
});
