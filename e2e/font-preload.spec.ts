import { test, expect } from "@playwright/test";

// 公開ページが「使わないフォント」を読み込んでいないことの検査。
//
// きっかけ: 等幅（Geist Mono）はルートレイアウトで宣言していたため、`font-mono` を一度も使わない
// 公開ページでも next/font が preload を張り、フォントファイルを取得していた（実測で本番の
// トップが woff2 を2本・計52KB 取得。うち約半分が等幅＝使われないまま捨てられていた）。
// 直しは layout.tsx の `preload: false`。同じ穴を二度開けないよう「取得は1本だけ」を検査に残す。
//
// 数ではなく実際のリクエストを数えるのは、preload の出方（HTML の <link> か HTTP の Link ヘッダか）が
// dev と本番で違うため。「何バイト取りに行ったか」はどちらでも同じに測れる。

test("公開ページが取得するフォントは本文用の1本だけ", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (req) => {
    if (/\.woff2?(\?|$)/.test(req.url())) fontRequests.push(req.url());
  });

  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();

  expect(fontRequests, `取得したフォント:\n${fontRequests.join("\n")}`).toHaveLength(1);
});
