import { test, expect } from "@playwright/test";

// ログイン済み状態での「読み取り専用」確認。storageState は playwright.config.ts の
// authenticated project で注入される。書き込み（投稿・ステータス変更）は一切行わない
// （本番DBを汚さないため）。書き込み系の e2e は dev 用 Supabase 作成後に追加する方針。

test.describe("ログイン済み（読み取りのみ）", () => {
  test("ヘッダーのユーザーメニューを開くとログアウトが出る", async ({ page }) => {
    await page.goto("/");
    // 未ログイン用の「会員登録」リンクは出ない。
    await expect(page.getByRole("link", { name: "会員登録" })).toHaveCount(0);
    // ログアウトはユーザーメニュー内なので、既定では表示されない。
    await expect(page.getByRole("menuitem", { name: "ログアウト" })).toHaveCount(0);
    // 表示名メニューを開くとログアウトが現れる。
    await page.locator('header button[aria-haspopup="menu"]').click();
    await expect(page.getByRole("menuitem", { name: "ログアウト" })).toBeVisible();
  });

  test("/submit に入れて投稿フォームの見出しが表示される（リダイレクトされない）", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/submit$/);
    await expect(page.getByRole("heading", { name: "投稿する" })).toBeVisible();
  });

  test("ヘッダーにメールではなく表示名が出る", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const email = process.env.E2E_TEST_EMAIL!;
    await expect(header).not.toContainText(email);
  });
});
