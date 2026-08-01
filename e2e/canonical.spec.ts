import { test, expect, type Page } from "@playwright/test";

// 正規 URL（<link rel="canonical">）の宣言を固定する。
//
// ここで見ているのは見た目ではなく**製品判断**なので、値そのものをテストにする:
//   - トップの ?page=N は「各ページが自分自身」= ページごとに載る投稿が違う＝別のページ。
//     トップに集約すると 2ページ目以降が重複扱いになり検索結果から落ちる
//     （Google も「1ページ目を正規にするな」としている）
//   - /reports の ?q= は「/reports へ集約」= 同じ一覧の絞り込みでしかなく、
//     検索語は無限に作れるため放置すると無数の URL がインデックス候補になる
//   - 1ページ目は ?page=1 を付けない（同じ内容が / と /?page=1 の2つの URL で見えるので / に揃える）
//
// 絶対 URL になるのは metadataBase（app/layout.tsx）の効果。ホスト部分は環境で変わらない
// ＝ Preview で測っても本番の住所が出るので、ここも含めて完全一致で見る。
//
// ⚠️ トップだけ末尾スラッシュが付かない（実測: "https://errata-hub.vercel.app"）。
//    Next.js が metadataBase と相対パスを合成するときに正規化するため。

const SITE = "https://errata-hub.vercel.app";

async function canonicalOf(page: Page, path: string) {
  await page.goto(path);
  return page.locator('link[rel="canonical"]').getAttribute("href");
}

test.describe("正規 URL（canonical）", () => {
  test("トップは自分自身を指す", async ({ page }) => {
    expect(await canonicalOf(page, "/")).toBe(SITE);
  });

  test("?page=1 は / に揃える（?page=1 を正規にしない）", async ({ page }) => {
    expect(await canonicalOf(page, "/?page=1")).toBe(SITE);
  });

  test("2ページ目は自分自身を指す（トップに集約しない）", async ({ page }) => {
    await page.goto("/?page=2");

    // 投稿が1ページに収まる環境では ?page=2 は範囲外で、307 で1ページ目へ寄せられる（page.tsx の redirect）。
    // その状態では「2ページ目の canonical」自体が存在しないので測れない
    test.skip(
      !page.url().includes("page=2"),
      "投稿が1ページに収まるためスキップ（?page=2 が範囲外）"
    );

    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(
      `${SITE}/?page=2`
    );
  });

  test("/reports は検索語が付いても /reports に集約する", async ({ page }) => {
    expect(await canonicalOf(page, "/reports")).toBe(`${SITE}/reports`);
    expect(await canonicalOf(page, "/reports?q=RFC")).toBe(`${SITE}/reports`);
  });
});
