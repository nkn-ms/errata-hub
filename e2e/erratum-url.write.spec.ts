import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { openReportByTitle } from "./find-report";

// 出版社の正誤表URL（PR#76）の e2e。ローカル dev＋ローカル Supabase 限定（write-local project）。
// 前提は他の書き込みテストと同じ: `supabase start` ＋ `npm run seed:local` 済みであること。
//
// このフローの肝は「読者の申告をそのまま公開しない」こと。外部リンクはフィッシング等の
// 攻撃面になるため、Report.reportedErratumUrl（申告）は公開ページに出さず、管理者が中身を
// 確認して Book.erratumUrl（公式）へ昇格させたものだけが読者に見える（schema.prisma / design.md）。

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

test.describe("正誤表URLの申告と採用", () => {
  test("読者の申告は公開されず、管理者が採用して初めて書籍ページに出る", async ({
    page,
    browser,
  }) => {
    const reportTitle = `E2E正誤表URL ${Date.now()}`;
    // 毎回ユニークにする（前回の実行で採用済みだと「既に登録済み」表示になり採用ボタンが出ないため）
    const reportedUrl = `https://example.com/errata/${Date.now()}`;

    // --- 読者として、正誤表URLを申告つきで投稿する ---
    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
    await page
      .getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true })
      .fill(reportTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");
    await page.getByPlaceholder("https://...").fill(reportedUrl);
    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);

    const reportId = await openReportByTitle(page, reportTitle);

    // 申告しただけの URL は公開ページのどこにも出ない（採用前）。
    // 「正誤表リンクが1本も無いこと」ではなく「申告した URL へのリンクが無いこと」を見る
    //  ＝ この本に既に別の公式 URL が登録済みでも成立する（判定の対象は申告 URL の公開可否）。
    await expect(page.getByText(reportedUrl)).toHaveCount(0);
    await page.goto(`/books/${BOOK_B.isbn}`);
    await expect(page.locator(`a[href="${reportedUrl}"]`)).toHaveCount(0);
    // 採用後に元へ戻せるよう、この本の現在の公式 URL を控えておく
    const officialLink = page.getByRole("link", { name: /出版社の正誤表を見る/ });
    const originalErratumUrl =
      (await officialLink.count()) > 0 ? await officialLink.getAttribute("href") : "";

    // --- 管理者として、内容を確認して採用する ---
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN);
      await adminPage.goto(`/admin/reports/${reportId}`);

      // 管理画面では申告 URL とリンク先ホストが見える（採用前に中身を確認するため）
      await expect(adminPage.getByText("投稿者が申告した正誤表URL")).toBeVisible();
      await expect(adminPage.getByText("リンク先ホスト: example.com")).toBeVisible();

      await adminPage.getByRole("button", { name: "この本の正誤表として採用" }).click();
      await expect(adminPage.getByText("この本の正誤表として採用しました")).toBeVisible();

      // 採用は操作ログに残る
      await adminPage.goto("/admin/logs");
      await expect(
        adminPage.getByRole("row").filter({ hasText: "正誤表URL採用" }).first()
      ).toBeVisible();

      // --- 採用後は公開ページに公式リンクとして出る ---
      await page.goto(`/books/${BOOK_B.isbn}`);
      const publicLink = page.getByRole("link", { name: /出版社の正誤表を見る/ });
      await expect(publicLink).toBeVisible();
      await expect(publicLink).toHaveAttribute("href", reportedUrl);
      // 外部リンクなので新規タブ＋参照元を渡さない属性が付いている
      await expect(publicLink).toHaveAttribute("rel", /noopener/);
      await expect(publicLink).toHaveAttribute("rel", /nofollow/);

      // --- 後片付け: テストが作った投稿を消し、本の正誤表URLを元へ戻す ---
      await adminPage.goto(`/admin/reports/${reportId}`);
      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "削除", exact: true }).click();
      await adminPage.waitForURL(/\/admin\/reports$/);

      await adminPage.goto("/admin/books");
      await adminPage
        .getByRole("row")
        .filter({ hasText: BOOK_B.title })
        .getByRole("link", { name: "編集" })
        .click();
      await adminPage.waitForURL(/\/admin\/books\/[0-9a-f-]+$/);
      // PR#96 でフォームの <label> が input と紐づいたので、ラベル名で直接指せる
      await adminPage.getByLabel("正誤表URL").fill(originalErratumUrl ?? "");
      await adminPage.getByRole("button", { name: "保存する" }).click();
      await expect(adminPage.getByText("保存しました")).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });
});
