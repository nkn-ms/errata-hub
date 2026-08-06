import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { createThrowawayAccount } from "./throwaway-user";
import { openReportByTitle } from "./find-report";
import { confirmAndSubmit } from "./submit-report";

// アカウント系（退会・表示名変更・パスワード再発行）の e2e。
// ローカル dev＋ローカル Supabase 限定（write-local project）。前提は他の書き込みテストと同じ。
//
// ⚠️ 退会はアカウントを消す不可逆な操作なので、**シードアカウントは絶対に使わない**。
// テストごとに使い捨てアカウントを作り（e2e/throwaway-user.ts）、それを退会させて終わる。

const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

async function withdraw(page: Page) {
  await page.goto("/account/withdraw");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "退会する" }).click();
  await page.waitForURL(/\/account\/withdrawn$/);
}

async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

// 使い捨てアカウントで1件投稿し、その投稿 id を返す
async function submitReport(page: Page, title: string): Promise<string> {
  await mockBookApis(page);
  await page.goto("/submit");
  await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.getByText(BOOK_B.title)).toBeVisible();

  await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
  await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
  await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(title);
  await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
  await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");
  await confirmAndSubmit(page);
  await page.waitForURL(/\/$/);

  return openReportByTitle(page, title);
}

// 管理者として投稿を削除（テストが作った投稿を残さないため）
async function deleteReportAsAdmin(browserContextPage: Page, reportId: string) {
  await login(browserContextPage, ADMIN);
  await browserContextPage.goto(`/admin/reports/${reportId}`);
  browserContextPage.once("dialog", (dialog) => dialog.accept());
  await browserContextPage.getByRole("button", { name: "削除", exact: true }).click();
  await browserContextPage.waitForURL(/\/admin\/reports$/);
}

test.describe("退会（書き込み）", () => {
  test("退会するとログインできなくなり、セッションも切れる", async ({ page }) => {
    const account = await createThrowawayAccount();
    await login(page, account);
    await expect(page.getByText(account.displayName).first()).toBeVisible();

    await page.goto("/account");
    await page.getByRole("link", { name: "退会手続きへ進む" }).click();
    await page.waitForURL(/\/account\/withdraw$/);

    // 同意チェックを入れるまで退会ボタンは押せない
    const withdrawButton = page.getByRole("button", { name: "退会する" });
    await expect(withdrawButton).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(withdrawButton).toBeEnabled();

    await withdrawButton.click();
    await page.waitForURL(/\/account\/withdrawn$/);
    await expect(page.getByRole("heading", { name: "退会が完了しました" })).toBeVisible();

    // セッションが破棄されている（保護ルートに入れない）
    await page.goto("/submit");
    await page.waitForURL(/\/login/);

    // 同じ資格情報ではもうログインできない（auth.users が削除されている）
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません")).toBeVisible();
  });

  test("退会しても投稿は残り、投稿者が「退会済みユーザー」になる（匿名化）", async ({ page, browser }) => {
    const account = await createThrowawayAccount();
    const reportTitle = `E2E退会テスト ${Date.now()}`;

    await login(page, account);
    const reportId = await submitReport(page, reportTitle);

    // 退会前は投稿者として表示名が出ている
    await expect(page.getByText(account.displayName).first()).toBeVisible();

    await withdraw(page);

    // 退会後も投稿は残る。ただし投稿者は匿名化されている（design.md §7 の退会＝匿名化）
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByRole("heading", { name: reportTitle })).toBeVisible();
    await expect(page.getByText("退会済みユーザー").first()).toBeVisible();
    await expect(page.getByText(account.displayName)).toHaveCount(0);

    // 後片付け: テストが作った投稿を管理者として削除する
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await deleteReportAsAdmin(adminPage, reportId);
    await adminContext.close();
  });
});

test.describe("表示名の変更（書き込み）", () => {
  test("変更するとヘッダーの表示が切り替わる", async ({ page }) => {
    const account = await createThrowawayAccount();
    await login(page, account);

    const newName = `${account.displayName}改`;
    await page.goto("/account");
    await page.locator("#displayName").fill(newName);
    await page.getByRole("button", { name: "表示名を変更" }).click();
    await expect(page.getByText("表示名を更新しました。")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(newName).first()).toBeVisible();

    // 後片付け: 使い捨てアカウントは残さない
    await withdraw(page);
  });
});

test.describe("パスワード再発行（書き込み）", () => {
  test("登録済みメールで送信すると送信完了ページに進む", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await page.locator("#email").fill(READER.email);
    await page.getByRole("button", { name: "再設定リンクを送信" }).click();
    await page.waitForURL(/\/auth\/reset-password\/sent$/);
  });

  test("未登録のメールでも同じ画面に進む（アカウント列挙対策）", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await page.locator("#email").fill(`no-such-user-${Date.now()}@local.test`);
    await page.getByRole("button", { name: "再設定リンクを送信" }).click();
    // 登録の有無を漏らさないため、登録済みのときと同じ結果になる（design.md §7）
    await page.waitForURL(/\/auth\/reset-password\/sent$/);
  });

  test("ログイン画面から再発行ページへ辿れる", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "パスワードをお忘れですか？" }).click();
    await page.waitForURL(/\/auth\/reset-password$/);
  });
});
