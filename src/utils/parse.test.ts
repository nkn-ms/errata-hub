import { describe, it, expect } from "vitest";
import { toIntOrNull } from "./parse";

describe("toIntOrNull", () => {
  it("数字の文字列を整数にする", () => {
    expect(toIntOrNull("42")).toBe(42);
    expect(toIntOrNull("1")).toBe(1);
  });

  it("未入力（空文字・空白のみ）は null", () => {
    expect(toIntOrNull("")).toBeNull();
    expect(toIntOrNull("   ")).toBeNull();
  });

  it("数値として読めない入力は NaN を返さず null にする", () => {
    expect(toIntOrNull("abc")).toBeNull();
  });
});
