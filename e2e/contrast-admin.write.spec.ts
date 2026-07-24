import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";
import { findLowContrastText, formatFindings } from "./contrast";

// 文字コントラスト（WCAG AA）のうち、ログインが要る画面＝管理画面。
// 書き込みはしないが、シードアカウントでのログインを伴うので write-local project に置く。
//
// ここを別に測る理由: 管理画面の帯は light でも暗い面（bg-gray-900）で、
// 公開側と**明暗が逆**になる。補助文字のトークンを濃くすると公開側は読みやすくなるが、
// 暗い帯の上では逆に読めなくなる（実測 6.82:1 → 3.67:1）。だから帯の中だけ 300 を使っている。

const ADMIN_PAGES = ["/admin/reports", "/admin/books", "/admin/publishers", "/admin/users", "/admin/logs"];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`文字コントラスト（管理画面・${colorScheme === "light" ? "ライト" : "ダーク"}）`, () => {
    test.use({ colorScheme });

    test("管理画面の全テキストが AA を満たす", async ({ page }) => {
      await login(page, ADMIN);

      for (const path of ADMIN_PAGES) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const findings = await findLowContrastText(page);
        expect(findings, `${path}:\n${formatFindings(findings)}`).toEqual([]);
      }
    });
  });
}
