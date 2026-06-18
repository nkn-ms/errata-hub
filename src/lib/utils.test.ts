import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("複数のクラス名を結合する", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("falsy な値を無視する", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("条件付きオブジェクト記法を解決する", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("競合する Tailwind ユーティリティは後勝ちでマージする", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-gray-700", "text-red-700")).toBe("text-red-700");
  });
});
