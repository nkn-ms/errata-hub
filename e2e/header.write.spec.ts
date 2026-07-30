import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// 共通ヘッダーのユーザーメニューの e2e。ログインが要るのでローカル限定（write-local project）。
// 前提は他の書き込みテストと同じ: `supabase start` ＋ `npm run seed:local` 済みであること。
// 何も書き込まないので、シードの状態は変わらない。

test.describe("ヘッダーの管理画面リンク", () => {
  test("管理者はユーザーメニューから管理画面へ入れる", async ({ page }) => {
    await login(page, ADMIN);

    await page.getByRole("button", { name: "ローカル管理者" }).click();
    await page.getByRole("menuitem", { name: "管理画面" }).click();

    await page.waitForURL(/\/admin\/reports$/);
    await expect(page.getByRole("heading", { name: "投稿一覧" })).toBeVisible();
  });

  test("一般ユーザーのメニューには管理画面が出ない", async ({ page }) => {
    await login(page, READER);

    await page.getByRole("button", { name: "ローカル読者" }).click();

    await expect(page.getByRole("menuitem", { name: "アカウント設定" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "管理画面" })).toHaveCount(0);
  });
});

// 未ログインのヘッダーの一様性は header-consistency.spec.ts が見る。こちらはログインが要る
// /account を含めて「ログイン済みでも画面によって中身が変わらない」ことを見る。
test.describe("ログイン済みヘッダーの中身", () => {
  for (const path of ["/", "/reports", "/submit", "/account"]) {
    test(`${path} でも同じナビ＋ユーザーメニューが出る`, async ({ page }) => {
      await login(page, READER);
      await page.goto(path);

      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "使い方" })).toBeVisible();
      await expect(header.getByRole("link", { name: "使用技術" })).toBeVisible();
      await expect(header.getByRole("link", { name: "投稿する" })).toBeVisible();
      await expect(header.getByRole("button", { name: "ローカル読者" })).toBeVisible();
      // ログイン済みなので未ログイン用の導線は出ない
      await expect(header.getByRole("link", { name: "ログイン" })).toHaveCount(0);
    });
  }
});
