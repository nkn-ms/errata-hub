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

  it("整数でない入力（小数・数字混じり）は切り捨てず null にする", () => {
    // parseInt だと "3.7"→3・"12abc"→12 と黙って通ってしまうケース
    expect(toIntOrNull("3.7")).toBeNull();
    expect(toIntOrNull("12abc")).toBeNull();
    expect(toIntOrNull("1e3")).toBe(1000); // 指数表記は整数値なので許容
  });
});
