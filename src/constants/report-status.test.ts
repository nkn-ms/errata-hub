import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_TOOLTIPS,
  STATUS_COLORS_BY_LABEL,
  STATUS_TOOLTIPS_BY_LABEL,
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

  it("ラベルに重複がない（BY_LABEL マップが欠落しない）", () => {
    const labels = Object.values(STATUS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("BY_LABEL マップは enum 由来の値と一致する", () => {
    for (const key of STATUS_KEYS) {
      const k = key as keyof typeof STATUS_LABELS;
      const label = STATUS_LABELS[k];
      expect(STATUS_COLORS_BY_LABEL[label]).toBe(STATUS_COLORS[k]);
      expect(STATUS_TOOLTIPS_BY_LABEL[label]).toBe(STATUS_TOOLTIPS[k]);
    }
  });

  it("既知のラベルが期待どおり", () => {
    expect(STATUS_LABELS.PENDING).toBe("未対応");
    expect(STATUS_LABELS.FIXED).toBe("修正済み");
    expect(STATUS_LABELS.DISMISSED).toBe("却下");
  });
});
