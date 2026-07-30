import { test, expect, type Page } from "@playwright/test";

// 公開側ヘッダーは「どのページでも同じ中身」であることを固定する回帰テスト。
//
// 以前はページ側が children でヘッダーの中身を渡していたため、トップと /reports だけがナビを持ち、
// /how-to-use は「投稿する」だけ、/tech は「使い方」だけ、詳細ページは何も無し、と画面ごとに
// ばらけていた。SiteHeader が自分でナビを出す形にして揃えたので、ページを足したときに
// 元へ戻っていないかをここで見る。
//
// 読み取り専用（未ログインで見える範囲だけ）。ログイン済みヘッダーは header.write.spec.ts で見る。

// ナビ項目は sm 以上でインライン表示（sm 未満はハンバーガー）。既定ビューポートは Desktop なので
// そのまま見える。
async function expectPublicHeader(page: Page) {
  const header = page.getByRole("banner");

  // トップだけロゴが自己リンクでなく span になるので、リンクではなく文字で見る
  await expect(header.getByText("Errata Hub")).toBeVisible();
  await expect(header.getByRole("button", { name: /表示テーマ/ })).toBeVisible();
  await expect(header.getByRole("link", { name: "使い方" })).toBeVisible();
  await expect(header.getByRole("link", { name: "使用技術" })).toBeVisible();
  await expect(header.getByRole("link", { name: "会員登録" })).toBeVisible();
  await expect(header.getByRole("link", { name: "ログイン" })).toBeVisible();
  await expect(header.getByRole("link", { name: "投稿する" })).toBeVisible();
}

// /submit はログインが要る（proxy.ts の protectedPaths）ので header.write.spec.ts 側で見る。
// /login・/register・/auth/* と退会フローは、フォームに集中させるため意図的にヘッダーを持たない。
const STATIC_PAGES = ["/", "/reports", "/how-to-use", "/tech", "/terms", "/privacy"];

test.describe("公開側ヘッダーの中身", () => {
  for (const path of STATIC_PAGES) {
    test(`${path} でも同じナビが出る`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expectPublicHeader(page);
    });
  }

  test("ロゴと主 CTA の位置がページ間で動かない", async ({ page }) => {
    // 中身が同じでも、ヘッダーの内容幅がページごとに違うと（以前は 2xl / lg / md を渡していた）
    // ロゴとナビが左右に動き、画面ごとにヘッダーが引っ越して見える。同じ x 座標に居ることを見る。
    const positions: { path: string; logoX: number; ctaRight: number }[] = [];
    for (const path of STATIC_PAGES) {
      await page.goto(path);
      const header = page.getByRole("banner");
      const logo = await header.getByText("Errata Hub").boundingBox();
      const cta = await header.getByRole("link", { name: "投稿する" }).boundingBox();
      positions.push({ path, logoX: logo!.x, ctaRight: cta!.x + cta!.width });
    }

    const [first, ...rest] = positions;
    for (const p of rest) {
      expect(p.logoX, `${p.path} のロゴの x が ${first.path} と違う`).toBeCloseTo(first.logoX, 0);
      expect(p.ctaRight, `${p.path} の「投稿する」の右端が ${first.path} と違う`).toBeCloseTo(
        first.ctaRight,
        0
      );
    }
  });

  test("投稿詳細・書籍詳細でも同じナビが出る（パンくずと共存する）", async ({ page }) => {
    await page.goto("/reports");

    // 詳細ページは実データが要るので、一覧から実在する URL を拾う（0件の環境ではスキップ）
    const reportLinks = page.locator('main a[href^="/reports/"]');
    const bookLinks = page.locator('main a[href^="/books/"]');
    test.skip((await reportLinks.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");

    const reportHref = await reportLinks.first().getAttribute("href");
    await page.goto(reportHref!);
    await expectPublicHeader(page);
    // パンくず（書籍名）が入っても、ナビはナビとして残っている
    await expect(page.getByRole("banner").locator('a[href^="/books/"]')).toBeVisible();

    const bookHref = await (async () => {
      await page.goto("/reports");
      return (await bookLinks.count()) > 0 ? bookLinks.first().getAttribute("href") : null;
    })();
    test.skip(bookHref === null, "書籍リンクが無いためスキップ");

    await page.goto(bookHref!);
    await expectPublicHeader(page);
  });
});
