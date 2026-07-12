import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// 書き込み系（投稿・賛同）の e2e。ローカル dev＋ローカル Supabase 限定で実行される
// （playwright.config.ts の write-local project は BASE_URL がローカルのときだけ有効）。
//
// 前提: `supabase start` ＋ `npm run seed:local` 済みであること。
//   - シードアカウント: admin@local.test（管理者・「サンプル投稿」の投稿者）
//                       reader@local.test（一般ユーザー）
//   - シード本B「マスタリングTCP/IP 入門編」は投稿0件（このテストで作成→削除して0件に戻す）
//
// 外部書誌API（OpenBD / Google Books）はモックする。書誌データの取得自体はテスト対象外で、
// 外部依存によるflakinessを避けるため。

// シードの本B（投稿なし）。投稿作成テストで使い、終了時に投稿を削除して元の状態に戻す。
const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

// 管理者がシードで作る投稿（賛同テストの対象＝reader から見て「他人の投稿」）。
const SEEDED_REPORT_TITLE = "サンプル投稿";

// ISBN検索が叩く書誌APIをシード本Bの応答で差し替える
async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  // OpenBD に書影が無いときの Google Books フォールバック（書影なしで応答）
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

test.describe("投稿フォーム（書き込み）", () => {
  test("書籍未選択で投稿するとエラーが表示される", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");
    await page.getByRole("button", { name: "投稿する" }).click();
    await expect(page.getByText("書籍を選択してください")).toBeVisible();
  });

  test("紙の書籍の正誤投稿が作成でき、一覧と詳細に反映される", async ({ page, browser }) => {
    const uniqueTitle = `E2E投稿テスト ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    // ISBN検索（既定モード）でシード本Bを選択
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    // 紙の必須項目（版・ページ）＋タイトル・正誤を入力
    await page.getByPlaceholder("例: 1", { exact: true }).fill("1"); // 版
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42"); // ページ番号
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("正字コード");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("文字コード");

    // 投稿は Server Action 経由（応答は JSON ではない）ので、成功はトップへの遷移で確認する
    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);

    // 一覧に新しい投稿が出る
    await page.getByPlaceholder("書籍名・タイトルで検索...").fill(uniqueTitle);
    const row = page.getByRole("row").filter({ hasText: uniqueTitle });
    await expect(row).toHaveCount(1);

    // 行クリックで詳細へ。入力した内容が表示される。投稿 id は URL から取得（後片付けで使う）
    await row.locator("td").last().click();
    await page.waitForURL(/\/reports\/[^/]+$/);
    const reportId = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
    await expect(page.getByText("正字コード")).toBeVisible();
    await expect(page.getByText("文字コード")).toBeVisible();

    // 後片付け: 管理画面の削除ボタンで削除し、本Bを「投稿0件」というシードの前提に戻す。
    // （途中のassert失敗時は残るが、ローカルDBなので seed し直せばよい）
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    // 削除アクションは成功時に一覧へ redirect する
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });
});

test.describe("賛同（書き込み）", () => {
  // シード投稿の詳細ページを開く
  async function openSeededReport(page: Page) {
    await page.goto("/");
    const row = page.getByRole("row").filter({ hasText: SEEDED_REPORT_TITLE });
    await row.first().locator("td").last().click();
    await page.waitForURL(/\/reports\/[^/]+$/);
  }

  test("他人の投稿に賛同でき、取り消すと元に戻る", async ({ page }) => {
    await login(page, READER);
    await openSeededReport(page);

    const button = page.getByRole("button", { name: /自分も見つけた/ });
    await expect(button).toBeEnabled();
    const countSpan = button.locator("span").last();
    const initialCount = Number(await countSpan.textContent());
    // 以前の実行の状態が残っていても通るよう、初期状態から±1のトグルとして検証する
    const initiallyUpvoted = (await button.getAttribute("title")) === "賛同を取り消す";

    await button.click();
    await expect(countSpan).toHaveText(String(initialCount + (initiallyUpvoted ? -1 : 1)));

    await button.click();
    await expect(countSpan).toHaveText(String(initialCount));
  });

  test("自分の投稿には賛同できない（ボタンが無効）", async ({ page }) => {
    await login(page, ADMIN);
    await openSeededReport(page);

    const button = page.getByRole("button", { name: /自分も見つけた/ });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "自分の投稿には賛同できません");
  });
});
