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

test("公開ページが取得するフォントは本文用の1本だけ", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (req) => {
    if (/\.woff2?(\?|$)/.test(req.url())) fontRequests.push(req.url());
  });

  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  expect(fontRequests, `取得したフォント:\n${fontRequests.join("\n")}`).toHaveLength(1);
});
