import { test, expect } from "@playwright/test";

// 読み取り専用スモークテスト。
// 本番 Supabase に接続するため、ここでは表示・遷移・バリデーションのみを確認し、
// 会員登録・ログイン・投稿などの「書き込み」は一切行わない（本番DBを汚さない）。

test.describe("トップページ", () => {
  test("最新の投稿が表示され、免責バナーとナビが出る", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "最新の投稿" })).toBeVisible();
    await expect(
      page.getByText("出版社による確認が完了していない", { exact: false })
    ).toBeVisible();

    // 未ログイン時のナビ
    await expect(page.getByRole("link", { name: "投稿する" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
    await expect(page.getByRole("link", { name: "会員登録" })).toBeVisible();
  });

  test("ログインリンクから /login に遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });
});

test.describe("ログインページ", () => {
  test("フォームの要素が揃っている", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("会員登録リンクから /register に遷移できる", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "会員登録" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe("会員登録ページ", () => {
  test("フォームの要素が揃っている", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "会員登録" })).toBeVisible();
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "会員登録" })).toBeVisible();
  });
});

test.describe("認可ゲート（proxy.ts）", () => {
  test("未ログインで /submit にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("未ログインで /admin にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("情報ページ", () => {
  test("使い方ページが開ける", async ({ page }) => {
    const res = await page.goto("/how-to-use");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/使い方/);
  });

  test("使用技術ページが開ける", async ({ page }) => {
    const res = await page.goto("/tech");
    expect(res?.status()).toBeLessThan(400);
  });
});

test.describe("存在しないルート", () => {
  test("404 を返す", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist-xyz");
    expect(res?.status()).toBe(404);
  });
});
