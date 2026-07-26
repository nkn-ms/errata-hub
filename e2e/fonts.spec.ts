import { test, expect } from "@playwright/test";

// フォントの検査。見ているのは「配っているフォントが本当に描画に使われているか」。
//
// きっかけ（2026-07-26 の実測）: 本番トップは woff2 を2本＝52KB 取得していたのに、本文用（Geist）は
// body の `font-family: Arial…` 直書きに負けて**一度も描画に使われていなかった**（@font-face は unloaded）。
// クラスや宣言の有無ではなく、computed の font-family と @font-face の状態で確かめる。

test("本文が Geist で描画され、日本語は OS のゴシックに落ちる", async ({ page }) => {
  await page.goto("/");
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

  // create-next-app の雛形は body に Arial を直書きしており、宣言だけした Geist が
  // 一度も使われていなかった（同じ状態に戻していないことの検査）
  expect(fontFamily).toMatch(/Geist/);
  // Geist は英数字しか字形を持たないので、総称ファミリが末尾に無いと日本語が
  // ブラウザ既定（環境によっては明朝）に落ちる。ここが保険になっている
  expect(fontFamily).toMatch(/sans-serif$/);
});

test("ISBN は等幅で描画される", async ({ page }) => {
  // ID を固定で書かず一覧の1件目から辿る（contrast.spec.ts と同じ方針）
  await page.goto("/reports");
  await page.locator("tbody tr").first().click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);

  const isbn = page.locator("span.font-mono").first();
  await expect(isbn).toBeVisible();
  await expect(isbn).toHaveText(/^\d{13}$/);

  // 実際に等幅で描画されていること（クラスが付いているだけでは確かめたことにならない）
  const fontFamily = await isbn.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toMatch(/Geist Mono/);
  // 総称ファミリの保険（監査ログの JSON など日本語が入り得る値のため）
  expect(fontFamily).toMatch(/monospace$/);

  // 実際にファイルが読み込まれて使われたこと。
  // ⚠️ woff2 のリクエスト本数では見ない（dev のルート初回コンパイルで本数が揺れ、実測で1度落ちた）。
  //    「@font-face が loaded になったか」なら取り違えずに測れる
  const monoLoaded = await page.evaluate(() =>
    [...document.fonts].some((f) => f.family === "Geist Mono" && f.status === "loaded")
  );
  expect(monoLoaded).toBe(true);
});
