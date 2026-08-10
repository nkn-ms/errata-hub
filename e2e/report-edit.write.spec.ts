import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { openReportByTitle } from "./find-report";
import { confirmAndSubmit } from "./submit-report";

// 投稿者による自分の投稿の編集と追記。ローカル dev＋ローカル Supabase 限定（write-local project）。
// 前提は他の書き込みテストと同じ: `supabase start` ＋ `npm run seed:local` 済みであること。
//
// この spec が守っている線引き:
//   未対応（PENDING）の間 = 本文を修正できる
//   出版社へ連絡した後     = 本文は直せず、追記だけできる

const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

// 使い捨ての投稿を1件作り、その id を返す
async function createReport(page: Page, title: string): Promise<string> {
  await mockBookApis(page);
  await page.goto("/submit");
  await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.getByText(BOOK_B.title)).toBeVisible();

  await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
  await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
  await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(title);
  await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("正字コード");
  await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("文字コード");
  await confirmAndSubmit(page);
  await page.waitForURL(/\/$/);

  return openReportByTitle(page, title);
}

// 管理者として「出版社へ連絡済み」にする（＝この時点から本文は直せなくなる）
async function forwardAsAdmin(page: Page, reportId: string) {
  await page.goto(`/admin/reports/${reportId}`);
  await page.getByRole("button", { name: "出版社へ連絡済み", exact: true }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("保存しました")).toBeVisible();
}

async function deleteReportAsAdmin(page: Page, reportId: string) {
  await page.goto(`/admin/reports/${reportId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.waitForURL(/\/admin\/reports$/);
}

test.describe("投稿者による編集（未対応の間）", () => {
  test("自分の投稿を直せて、編集日時が入る", async ({ page, browser }) => {
    const title = `E2E編集テスト ${Date.now()}`;
    await login(page, READER);
    const reportId = await createReport(page, title);

    // 投稿直後は編集日時が「-」（触っていないものを編集済みと言わない）
    await expect(page.getByText(/^投稿日時: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)).toBeVisible();
    await expect(page.getByText("編集日時: -")).toBeVisible();

    await page.getByRole("link", { name: "投稿を編集する" }).click();
    await page.waitForURL(/\/reports\/[^/]+\/edit$/);

    // 書籍は確定表示で、選び直せない（本を変えるのは別の投稿を作ること）
    await expect(page.getByText(BOOK_B.title)).toBeVisible();
    await expect(page.getByPlaceholder("例: 9784873116860", { exact: true })).toHaveCount(0);

    // 入力欄には今の内容が入っている（新規投稿と同じ欄を共有している）
    await expect(page.getByPlaceholder("例: 42", { exact: true })).toHaveValue("42");
    await expect(page.getByPlaceholder("誤りのある文章をそのまま入力してください")).toHaveValue("正字コード");

    await page.getByPlaceholder("例: 42", { exact: true }).fill("141");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("文字符号化方式");
    await page.getByRole("button", { name: "更新する" }).click();

    await page.waitForURL(/\/reports\/[^/]+$/);
    await expect(page.getByText("p.141")).toBeVisible();
    await expect(page.getByText("文字符号化方式")).toBeVisible();
    await expect(page.getByText(/^編集日時: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)).toBeVisible();

    // 未対応の間は追記の欄を出さない（本文を直せるので、同じことを2つの経路で言わせない）
    await expect(page.getByRole("button", { name: "追記する" })).toHaveCount(0);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await deleteReportAsAdmin(adminPage, reportId);
    await adminContext.close();
  });

  test("他人の投稿は編集できず、URL を直接開いても詳細へ戻される", async ({ page, browser }) => {
    const title = `E2E他人の投稿 ${Date.now()}`;
    await login(page, READER);
    const reportId = await createReport(page, title);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      // 管理者から見ても「投稿を編集する」は出ない（管理者でも本文は直せない＝規約第6条3項）
      await login(adminPage, ADMIN);
      await adminPage.goto(`/reports/${reportId}`);
      await expect(adminPage.getByRole("link", { name: "投稿を編集する" })).toHaveCount(0);

      // URL を直接叩いても編集画面は出ず、詳細へ戻される（404 にはしない＝投稿自体は公開されている）
      await adminPage.goto(`/reports/${reportId}/edit`);
      await adminPage.waitForURL(`**/reports/${reportId}`);
      await expect(adminPage.getByRole("button", { name: "更新する" })).toHaveCount(0);

      await deleteReportAsAdmin(adminPage, reportId);
    } finally {
      await adminContext.close();
    }
  });
});

test.describe("追記（出版社へ連絡した後）", () => {
  test("連絡後は本文を直せず、追記だけできる", async ({ page, browser }) => {
    const title = `E2E追記テスト ${Date.now()}`;
    await login(page, READER);
    const reportId = await createReport(page, title);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN);
      await forwardAsAdmin(adminPage, reportId);

      // 投稿者の画面から編集の導線が消え、代わりに追記の欄が出る
      await page.goto(`/reports/${reportId}`);
      await expect(page.getByRole("link", { name: "投稿を編集する" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "追記する" })).toBeVisible();

      // 編集画面を直接開いても詳細へ戻される（画面を出す時点での判定。
      // 保存側でもトランザクションの中で改めて確かめている = actions/report.ts）
      await page.goto(`/reports/${reportId}/edit`);
      await page.waitForURL(`**/reports/${reportId}`);

      // ⚠️ 検査に使う文言を placeholder の例文と同じにしないこと。getByText が placeholder に
      //    当たって「保存された」と誤判定し、保存を待たずに次の操作へ進む（実際にこれで落ちた）
      const first = "第3刷では直っていた（追記1）";
      const second = "正誤表にも掲載された（追記2）";

      await page.getByLabel("追記する").fill(first);
      await page.getByRole("button", { name: "追記する" }).click();
      await expect(page.getByText(first)).toBeVisible();
      // 本文は元のまま（追記は足すだけで上書きしない）
      await expect(page.getByText("正字コード")).toBeVisible();
      await expect(page.getByText("文字コード")).toBeVisible();

      // 2件目を足しても1件目は残る（＝列1本ではなくテーブルにした理由）
      await page.getByLabel("追記する").fill(second);
      await page.getByRole("button", { name: "追記する" }).click();
      await expect(page.getByText(second)).toBeVisible();
      await expect(page.getByText(first)).toBeVisible();

      await deleteReportAsAdmin(adminPage, reportId);
    } finally {
      await adminContext.close();
    }
  });
});
