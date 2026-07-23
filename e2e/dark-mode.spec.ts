import { test, expect, type Page } from "@playwright/test";

// ダークモード（OS 追従）の読み取りスモーク。
//
// 実装は globals.css で Tailwind のテーマ変数（--color-*）を差し替える方式で、
// 画面に出るクラス名は light と同じ。つまり **クラス名を見ても検証にならない**ので、
// 実際に計算されたスタイルが反転していること・地と文字のコントラストが足りていることを見る。
// 色を1か所で決めている以上、事故はサイト全体に波及するため。

// 計算値は rgb() とは限らない（Tailwind v4 の既定パレットは lab()/oklch() で返る）。
// canvas に1px 描いて読むと、どの記法でも sRGB に揃う。
async function colorReader(page: Page) {
  return {
    /** セレクタの要素の文字色・背景色を [r,g,b,a] で返す（背景は透明なら親を辿る） */
    async of(selector: string) {
      return page.evaluate((sel) => {
        const ctx = document.createElement("canvas").getContext("2d")!;
        const toRgba = (color: string): number[] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data);
        };
        const el = sel === "body" ? document.body : document.querySelector(sel);
        if (!el) throw new Error(`要素が見つからない: ${sel}`);
        let bgEl: Element | null = el;
        let bg = [0, 0, 0, 255];
        while (bgEl) {
          const c = toRgba(getComputedStyle(bgEl).backgroundColor);
          if (c[3] > 128) { bg = c; break; }
          bgEl = bgEl.parentElement;
        }
        return { fg: toRgba(getComputedStyle(el).color), bg };
      }, selector);
    },
  };
}

// 相対輝度（出典: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance ）
function luminance(c: number[]): number {
  const [r, g, b] = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("ダークモード（OS がダークのとき）", () => {
  test.use({ colorScheme: "dark" });

  test("トップページの地が暗く反転し、本文とのコントラストが AA を満たす", async ({ page }) => {
    await page.goto("/");
    const { fg, bg } = await (await colorReader(page)).of("body");

    expect(luminance(bg)).toBeLessThan(0.1); // 地は暗い
    expect(luminance(fg)).toBeGreaterThan(0.5); // 文字は明るい
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5); // WCAG AA（通常文字）
  });

  test("カードの面はページ背景より明るい（面の段差が残る）", async ({ page }) => {
    await page.goto("/");
    const read = await colorReader(page);

    // 面の重なりが潰れると「のっぺりした真っ黒」になる。bg-white の面が
    // ページ背景（bg-gray-50）より明るいことを確かめる
    const pageBg = (await read.of("body")).bg;
    const cardBg = (await read.of("header")).bg;

    expect(luminance(cardBg)).toBeGreaterThan(luminance(pageBg));
  });

  // ※ 管理画面の帯（light でも暗い面だったので反転すると真っ白になる箇所）は
  //   ログインが要るため dark-mode-admin.write.spec.ts で検証する。

  test("フォームの入力欄もダークになる（color-scheme が効いている）", async ({ page }) => {
    await page.goto("/login");

    // color-scheme: dark を宣言していないと、入力欄だけ白いまま浮く
    const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    expect(scheme).toBe("dark");

    const { bg } = await (await colorReader(page)).of("#email");
    expect(luminance(bg)).toBeLessThan(0.2);
  });

  test("バッジは「濃い地＋淡い文字」に入れ替わる（読める）", async ({ page }) => {
    await page.goto("/reports");

    // 種別バッジ（bg-*-100 text-*-700）は light では「淡い地＋濃い文字」。
    // 反転して読めなくなるのがいちばん起きやすい壊れ方なので、実測で止める
    const badge = page.locator("tbody span[class*='rounded-full']").first();
    await expect(badge).toBeVisible();
    const colors = await badge.evaluate((el) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const toRgba = (color: string): number[] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const s = getComputedStyle(el);
      return { fg: toRgba(s.color), bg: toRgba(s.backgroundColor) };
    });
    expect(luminance(colors.fg)).toBeGreaterThan(luminance(colors.bg));
    expect(contrastRatio(colors.fg, colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("ライトモード（OS がライトのとき）", () => {
  test.use({ colorScheme: "light" });

  test("これまで通り明るい配色のまま", async ({ page }) => {
    await page.goto("/");
    const { fg, bg } = await (await colorReader(page)).of("body");

    expect(luminance(bg)).toBeGreaterThan(0.7);
    expect(luminance(fg)).toBeLessThan(0.2);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
