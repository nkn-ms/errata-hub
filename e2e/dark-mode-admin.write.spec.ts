import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";

// ダークモードのうち、ログインが要る画面（管理画面）の検証。
// 書き込みはしないが、シードアカウントでのログインを伴うので write-local project に置く。
//
// 見ているのは「テーマ変数の反転で裏返ってしまう面」の打ち消し。
// 管理画面の帯は light でも bg-gray-900（暗い面）なので、変数を反転すると
// dark で真っ白な板になる。admin/layout.tsx の dark: がそれを止めている。

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

test.describe("ダークモード（管理画面）", () => {
  test.use({ colorScheme: "dark" });

  test("管理画面の帯は暗いままで、ナビの文字も読める", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/reports");

    const colors = await page.locator("header").first().evaluate((el) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const toRgba = (color: string): number[] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const nav = el.querySelector("a")!;
      return {
        bar: toRgba(getComputedStyle(el).backgroundColor),
        navText: toRgba(getComputedStyle(nav).color),
      };
    });

    // 帯は暗いまま（反転して白くなっていない）
    expect(luminance(colors.bar)).toBeLessThan(0.1);
    // ナビの文字は帯の上で AA を満たす
    expect(contrastRatio(colors.navText, colors.bar)).toBeGreaterThanOrEqual(4.5);
  });
});
