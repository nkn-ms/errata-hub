import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  THEME_CHOICES,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isThemeChoice,
  nextThemeChoice,
  resolveTheme,
  type ThemeChoice,
} from "./theme";

describe("isThemeChoice", () => {
  it("選択肢だけを通す", () => {
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
  });

  it("壊れた保存値は弾く（localStorage は誰でも書き換えられる）", () => {
    expect(isThemeChoice("DARK")).toBe(false);
    expect(isThemeChoice("")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
  });
});

describe("nextThemeChoice", () => {
  it("OS の設定 → ライト → ダーク → OS の設定 と一周する", () => {
    expect(nextThemeChoice("system")).toBe("light");
    expect(nextThemeChoice("light")).toBe("dark");
    expect(nextThemeChoice("dark")).toBe("system");
  });

  it("何回押しても選択肢の外に出ない", () => {
    let choice: ThemeChoice = "system";
    for (let i = 0; i < 10; i++) {
      choice = nextThemeChoice(choice);
      expect(isThemeChoice(choice)).toBe(true);
    }
  });
});

describe("resolveTheme", () => {
  it("明示指定は OS の設定より優先される", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("OS の設定に合わせるときだけ matchMedia の結果に従う", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

// 初期化スクリプトは <head> で素の JS として走るため resolveTheme を import できず、
// 同じ判定を書き写している。ずれたらテーマが一瞬ちらつく（＝直りにくい不具合になる）ので、
// 文字列を実際に実行して resolveTheme と同じ結論になることを確かめる。
describe("THEME_INIT_SCRIPT", () => {
  function runScript({ stored, osPrefersDark }: { stored: string | null; osPrefersDark: boolean }) {
    document.documentElement.removeAttribute("data-theme");
    if (stored === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, stored);
    // jsdom は matchMedia を実装していないので、OS の設定として差し込む
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: osPrefersDark, media: query }));

    new Function(THEME_INIT_SCRIPT)();
    return document.documentElement.getAttribute("data-theme");
  }

  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("保存値 × OS の設定のすべての組み合わせで resolveTheme と一致する", () => {
    for (const stored of [...THEME_CHOICES, null]) {
      for (const osPrefersDark of [true, false]) {
        const choice: ThemeChoice = stored ?? "system";
        expect(runScript({ stored, osPrefersDark })).toBe(resolveTheme(choice, osPrefersDark));
      }
    }
  });

  it("保存値が壊れていても OS 追従に落ちる", () => {
    expect(runScript({ stored: "purple", osPrefersDark: true })).toBe("dark");
    expect(runScript({ stored: "purple", osPrefersDark: false })).toBe("light");
  });

  it("localStorage が使えない環境でも例外を投げない（描画を止めない）", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("ストレージが無効");
    });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    document.documentElement.removeAttribute("data-theme");

    expect(() => new Function(THEME_INIT_SCRIPT)()).not.toThrow();
    // 属性を書けないので既定（= CSS 側のライト）のまま
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    getItem.mockRestore();
  });
});
