import { test, expect } from "@playwright/test";

// フォントの検査。「配っているものが使われているか」「使うものだけ配っているか」の両方を見る。
//
// きっかけ（2026-07-26 の実測）: 本番トップは woff2 を2本＝52KB 取得していたのに、
//   - 本文用（Geist）は body の `font-family: Arial…` 直書きに負けて**一度も描画に使われていなかった**
//   - 等幅（Geist Mono）は管理画面でしか使わないのに全ルートで preload されていた
// ＝ 52KB を落として実質どちらも捨てていた。直しは globals.css のトークン参照化と `preload: false`。
//
// 取得本数を <link> の数ではなく実際のリクエストで数えるのは、preload の出方
// （HTML の <link> か HTTP の Link ヘッダか）が dev と本番で違うため。バイトを取りに行ったかは同じに測れる。

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

test("等幅を使わない画面は本文用の1本しか取得しない", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (req) => {
    if (/\.woff2?(\?|$)/.test(req.url())) fontRequests.push(req.url());
  });

  // トップページには ISBN の表示が無い＝等幅を使わない
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  expect(fontRequests, `取得したフォント:\n${fontRequests.join("\n")}`).toHaveLength(1);
});

test("ISBN は等幅で描画され、その画面で等幅フォントが読み込まれる", async ({ page }) => {
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

  // preload を切ってあるので、等幅は「使うこの画面で」初めて読み込まれる。
  // ⚠️ リクエスト本数では見ない（dev はルートの初回コンパイルで woff2 の取得本数が揺れ、実測で1度落ちた）。
  //    「@font-face が loaded になったか」なら、取得され描画に使われたことを取り違えずに測れる
  const monoLoaded = await page.evaluate(() =>
    [...document.fonts].some((f) => f.family === "Geist Mono" && f.status === "loaded")
  );
  expect(monoLoaded).toBe(true);
});
