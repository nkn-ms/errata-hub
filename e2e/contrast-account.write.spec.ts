import { test, expect } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { findLowContrastText, formatFindings } from "./contrast";

// アカウント設定（/account）と退会ページ（/account/withdraw）の文字コントラスト（WCAG AA）。
// ログインが要るので write-local project に置く（退会は実行しないので何も書き込まない）。
//
// 管理画面（contrast-admin）と分けているのは、ここが**公開側の配色**の画面だから
// （管理画面の帯だけは light でも暗い面で、補助文字に別の段を使っている）。
// 退会ページは赤い文字と赤いボタンが集まる唯一の公開側画面なので、赤の段を測る場でもある。

const ACCOUNT_PAGES = ["/account", "/account/withdraw"];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`文字コントラスト（アカウント・${colorScheme === "light" ? "ライト" : "ダーク"}）`, () => {
    test.use({ colorScheme });

    test("アカウント設定・退会ページの全テキストが AA を満たす", async ({ page }) => {
      await login(page, READER);

      for (const path of ACCOUNT_PAGES) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const findings = await findLowContrastText(page);
        expect(findings, `${path}:\n${formatFindings(findings)}`).toEqual([]);
      }
    });
  });
}
