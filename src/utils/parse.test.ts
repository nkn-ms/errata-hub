import { describe, it, expect } from "vitest";
import { normalizeDigits, toIntOrNull, toPageNumber } from "./parse";

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

  // IME の確定の仕方で全角のまま残ることがあり、変換しないと「入力したのに未入力扱い」になる
  it("全角数字を半角として読む", () => {
    expect(toIntOrNull("１４１")).toBe(141);
    expect(toIntOrNull("４２")).toBe(42);
    // 全角と半角が混ざった入力（変換されかけた状態）も読める
    expect(toIntOrNull("1４1")).toBe(141);
  });
});

describe("toPageNumber", () => {
  it("正の整数はそのまま読む", () => {
    expect(toPageNumber("1")).toBe(1);
    expect(toPageNumber("42")).toBe(42);
  });

  it("未指定は1ページ目", () => {
    expect(toPageNumber(undefined)).toBe(1);
    expect(toPageNumber("")).toBe(1);
  });

  // ここを通さないと Prisma が「Argument `skip` is missing」で落ちてエラー画面になる（実測）
  it("数字として読めない値は1ページ目（NaN を skip に流さない）", () => {
    expect(toPageNumber("abc")).toBe(1);
    expect(toPageNumber("12abc")).toBe(1);
  });

  it("0以下は1ページ目", () => {
    expect(toPageNumber("0")).toBe(1);
    expect(toPageNumber("-5")).toBe(1);
  });

  it("小数は1ページ目（skip が整数でなくなるため）", () => {
    expect(toPageNumber("2.7")).toBe(1);
  });

  // skip が 64bit に収まらず Prisma が落ちるケース。指数表記は Number が読んでしまう
  it("安全整数を超える値は1ページ目", () => {
    expect(toPageNumber("1e21")).toBe(1);
    expect(toPageNumber(String(Number.MAX_SAFE_INTEGER + 2))).toBe(1);
    // 安全整数の上限ちょうどは「読める値」として通す（大きすぎるページ番号の救済は呼び出し側の仕事）
    expect(toPageNumber(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("normalizeDigits", () => {
  it("全角数字を半角にし、前後の空白を落とす", () => {
    expect(normalizeDigits("１４１")).toBe("141");
    expect(normalizeDigits(" 42 ")).toBe("42");
  });

  it("半角の数字はそのまま", () => {
    expect(normalizeDigits("42")).toBe("42");
    expect(normalizeDigits("")).toBe("");
  });

  // 数字以外を落としたり切り詰めたりはしない（何を入れたかは利用者に見せたまま検証で弾く）
  it("数字でない文字は消さない", () => {
    expect(normalizeDigits("42ページ")).toBe("42ページ");
  });
});
