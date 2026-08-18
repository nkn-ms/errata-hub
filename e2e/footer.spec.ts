import { test, expect } from "@playwright/test";

// フッターのリンク。
//
// なぜ必要か: ヘッダーは「利用者の導線」に絞り、作り手向けの説明（使用技術・デザインシステム）は
// フッターに集めている。つまり**この2ページはフッターからしか辿れない**ので、
// リンクが1つ消えると到達できなくなる（URL を直に開くテストは通ったままなので気づけない）。
//
// あわせて「ヘッダーとフッターで重複させない」という規約そのものも固定する。

const LINKS = ["使用技術", "デザインシステム", "利用規約", "プライバシーポリシー", "ソースコード"];

test.describe("フッター", () => {
  test("作り手向けの説明と法務・ソースへ辿れる", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const name of LINKS) {
      await expect(footer.getByRole("link", { name })).toBeVisible();
    }
  });

  test("ヘッダーとリンクを重複させない", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    for (const name of LINKS) {
      await expect(header.getByRole("link", { name })).toHaveCount(0);
    }
  });
});
