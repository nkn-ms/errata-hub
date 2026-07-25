import { test, expect } from "@playwright/test";
import { findLowContrastText, formatFindings } from "./contrast";

// 文字コントラスト（WCAG AA）の総当たり検査。ライト／ダークの両方で回す。
//
// きっかけ: ライトの補助文字（text-gray-400 = 投稿日・@短縮ID・ISBN・注記など）が
// 2.5:1 しかなく AA を割っていた。トークンを濃くして直したが、同じ穴を二度開けないために
// 「基準を割る文字が1つも無い」ことを検査として残す。判定の詳細は ./contrast.ts。

// ゲストで開ける主要ページ（ログインが要る画面は contrast-admin.write.spec.ts 側）
const GUEST_PAGES = [
  "/",
  "/reports",
  "/how-to-use",
  "/tech",
  "/login",
  "/register",
  "/terms",
  "/privacy",
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`文字コントラスト（${colorScheme === "light" ? "ライト" : "ダーク"}）`, () => {
    test.use({ colorScheme });

    for (const path of GUEST_PAGES) {
      test(`${path} の全テキストが AA を満たす`, async ({ page }) => {
        await page.goto(path);
        const findings = await findLowContrastText(page);
        expect(findings, `AA を割っている文字:\n${formatFindings(findings)}`).toEqual([]);
      });
    }

    test("投稿詳細・書籍詳細の全テキストが AA を満たす", async ({ page }) => {
      // ID を固定で書かず、一覧の1件目から辿る（シードが変わっても壊れない）。
      // 遷移の待ちは URL で見る: 見出しの有無だけだと遷移前のページを測ってしまう
      await page.goto("/reports");
      await page.locator("tbody tr").first().click();
      await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);

      let findings = await findLowContrastText(page);
      expect(findings, `投稿詳細:\n${formatFindings(findings)}`).toEqual([]);

      await page.getByRole("link", { name: "この本の投稿一覧" }).click();
      await page.waitForURL(/\/books\/\d{13}$/);

      findings = await findLowContrastText(page);
      expect(findings, `書籍詳細:\n${formatFindings(findings)}`).toEqual([]);
    });
  });
}
