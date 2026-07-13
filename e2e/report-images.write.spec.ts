import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// 画像添付つき投稿の e2e。ローカル dev＋ローカル Supabase 限定（write-local project）。
//
// 前提: `supabase start` ＋ `npm run seed:local` に加えて、**Storage バケットが必要**。
//   バケット report-images は supabase/config.toml に定義済みだが、`supabase start` だけでは
//   作られないことがある（実測）。無い場合は `supabase seed buckets` を実行する。
//
// 画像アップロードだけは Server Actions ではなく Route Handler（POST /api/reports/[id]/images）。
// Server Actions のボディ上限が既定 1MB のため（design.md §7）。この経路の回帰をここで止める。

const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

// 1x1 の PNG（テスト用の最小画像）。base64 は PNG シグネチャから作った固定値。
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

test.describe("画像添付つき投稿（書き込み）", () => {
  test("画像を添付して投稿でき、詳細ページに証拠画像が表示される", async ({ page, browser }) => {
    const uniqueTitle = `E2E画像テスト ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("1"); // 版
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42"); // ページ
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");

    // 画像を添付（選択直後にローカルプレビューが出る）
    await page.locator('input[type="file"]').setInputFiles({
      name: "errata.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(page.getByAltText("errata.png")).toBeVisible();

    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);

    // 詳細ページで「証拠画像」として表示される（＝Storage への保存と ReportImage 行の作成が成功している）
    await page.getByPlaceholder("書籍名・タイトルで検索...").fill(uniqueTitle);
    const row = page.getByRole("row").filter({ hasText: uniqueTitle });
    await row.locator("td").last().click();
    await page.waitForURL(/\/reports\/[^/]+$/);
    const reportId = page.url().split("/").pop()!;

    const image = page.getByAltText("証拠画像");
    await expect(image).toBeVisible();
    // 画像は Supabase Storage の公開 URL を指す（バケット名まで確認する）
    await expect(image).toHaveAttribute("src", /report-images/);

    // 後片付け: 管理画面から削除（ReportImage と Storage 上のファイルも掃除される）
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });

  test("許可外の形式（テキストファイル）は添付できずエラーになる", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");

    await page.locator('input[type="file"]').setInputFiles({
      name: "not-an-image.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("これは画像ではない"),
    });

    await expect(page.getByText("画像は JPEG / PNG / WebP のみ添付できます")).toBeVisible();
  });
});
