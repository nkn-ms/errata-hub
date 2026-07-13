import { type Page } from "@playwright/test";

// 書き込み系 e2e の共通ログイン。シードアカウント（e2e/seed-accounts.ts）で入る。
// 失敗時は /login に留まるので、waitForURL のタイムアウトが「シード未実行」の目印になる。
export async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}
