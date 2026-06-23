import { test, expect } from "@playwright/test";

// ログイン済み状態での「読み取り専用」確認。storageState は playwright.config.ts の
// authenticated project で注入される。書き込み（投稿・ステータス変更）は一切行わない
// （本番DBを汚さないため）。書き込み系の e2e は dev 用 Supabase 作成後に追加する方針。

test.describe("ログイン済み（読み取りのみ）", () => {
  test("トップのヘッダーにログアウトボタンが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
    // 未ログイン用の「会員登録」リンクは出ない。
    await expect(page.getByRole("link", { name: "会員登録" })).toHaveCount(0);
  });

  test("/submit に入れて投稿フォームの見出しが表示される（リダイレクトされない）", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/submit$/);
    await expect(page.getByRole("heading", { name: "投稿する" })).toBeVisible();
  });
});
