import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";

// 等幅フォントの preload を切った副作用の確認（font-preload.spec.ts の裏返し）。
// preload を切っても「使う画面では読み込まれる」ことを、実際に描画されている font-family で確かめる。
// ここが崩れると ISBN や監査ログの桁が揃わなくなる（等幅にしている理由そのものが失われる）。

test("管理画面の ISBN は等幅フォントで描画される", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/books");

  const isbnCell = page.locator("td.font-mono").first();
  await expect(isbnCell).toBeVisible();

  // next/font が生成する font-family 名（実測: `"Geist Mono", "Geist Mono Fallback"`）
  const fontFamily = await isbnCell.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toMatch(/Geist Mono/i);
});
