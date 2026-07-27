import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";

// 書籍マスタ編集（/admin/books/[id]）の e2e。ローカル dev＋ローカル Supabase 限定（write-local project）。
// 前提は他の書き込みテストと同じ: `supabase start` ＋ `npm run seed:local` 済みであること。
//
// 担保したいのは編集そのものより **書籍マスタの不変条件**:
//   - ISBN は編集不可（本の同一性の基準 = decision-isbn-required / schema.prisma）
//   - 投稿が紐づく書籍は削除できない（UI の件数チェックと DB の Restrict で二重ガード）
//   - OpenBD の差分取り込みは「反映」しても保存はされない（管理者が確認して保存する2段構え）
// 編集した値はテストの最後に必ず元へ戻す（繰り返し実行できるようにするため）。

const BOOK_WITH_REPORT = "Web API:The Good Parts"; // シード投稿が紐づく本（削除できない側）
const BOOK_EDITABLE = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
};

async function openBookEditor(page: Page, title: string) {
  await page.goto("/admin/books");
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("link", { name: "編集" })
    .click();
  await page.waitForURL(/\/admin\/books\/[0-9a-f-]+$/);
}

test.describe("書籍マスタの編集（管理者）", () => {
  test("書籍名と正誤表URLを保存すると公開ページに反映される", async ({ page }) => {
    const newTitle = `${BOOK_EDITABLE.title}（E2E編集 ${Date.now()}）`;
    const newErratumUrl = `https://example.com/errata/book-${Date.now()}`;

    await login(page, ADMIN);
    await openBookEditor(page, BOOK_EDITABLE.title);

    // 戻せるように現在の値を控える（他のテストが正誤表URLを入れている場合もある）
    const originalTitle = await page.getByLabel("書籍名").inputValue();
    const originalErratumUrl = await page.getByLabel("正誤表URL").inputValue();

    await page.getByLabel("書籍名").fill(newTitle);
    await page.getByLabel("正誤表URL").fill(newErratumUrl);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    // 公開側の書籍ページに反映される
    await page.goto(`/books/${BOOK_EDITABLE.isbn}`);
    await expect(page.getByRole("heading", { name: newTitle })).toBeVisible();
    const publicLink = page.getByRole("link", { name: /出版社の正誤表を見る/ });
    await expect(publicLink).toHaveAttribute("href", newErratumUrl);

    // 後片付け: 元の値へ戻す
    await openBookEditor(page, newTitle);
    await page.getByLabel("書籍名").fill(originalTitle);
    await page.getByLabel("正誤表URL").fill(originalErratumUrl);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.goto(`/books/${BOOK_EDITABLE.isbn}`);
    await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible();
  });

  test("ISBN は編集できない", async ({ page }) => {
    await login(page, ADMIN);
    await openBookEditor(page, BOOK_EDITABLE.title);

    // ISBN は本の同一性の基準なので、間違いを直す用途でも編集させない（別の本になってしまうため）
    const isbnInput = page.getByLabel("ISBN（変更不可）");
    await expect(isbnInput).toHaveValue(BOOK_EDITABLE.isbn);
    await expect(isbnInput).toHaveAttribute("readonly", "");
  });

  test("投稿が紐づく書籍は削除できない（理由も表示される）", async ({ page }) => {
    await login(page, ADMIN);
    await openBookEditor(page, BOOK_WITH_REPORT);

    // UI 側のガード。最終保証は Book への FK（onDelete: Restrict）が担うので、
    // ここで見ているのは「押させない・理由を示す」という UX 側の約束
    await expect(page.getByRole("button", { name: "削除" })).toBeDisabled();
    await expect(page.getByText(/件の投稿が紐づいているため削除できません/)).toBeVisible();
  });
});

test.describe("OpenBD の差分取り込み（管理者）", () => {
  test("差分を反映しても保存するまでは書籍マスタは変わらない", async ({ page }) => {
    const openBdTitle = `${BOOK_EDITABLE.title}（OpenBD版）`;

    // 外部 API は叩かない（ネットワークとレスポンス内容に依存させないため差し替える）
    await page.route("**/api/books/openbd*", (route) =>
      route.fulfill({
        json: [
          {
            summary: {
              isbn: BOOK_EDITABLE.isbn,
              title: openBdTitle,
              author: "井上,直也,1974-",
              publisher: "オーム社",
              cover: "",
            },
          },
        ],
      })
    );

    await login(page, ADMIN);
    await openBookEditor(page, BOOK_EDITABLE.title);
    const originalTitle = await page.getByLabel("書籍名").inputValue();

    await page.getByRole("button", { name: "ISBNで最新取得" }).click();

    // 差分のある行に「反映」が出る（同じ値の行には出ない）
    const titleRow = page.getByRole("row").filter({ hasText: "書籍名" });
    await expect(titleRow).toContainText(openBdTitle);
    await titleRow.getByRole("button", { name: "反映" }).click();

    // 入力欄は置き換わるが、まだ保存はされていない
    await expect(page.getByLabel("書籍名")).toHaveValue(openBdTitle);
    await expect(page.getByText("反映してもまだ保存はされません")).toBeVisible();

    // 保存せずに読み込み直すと元の値のまま＝ DB は変わっていない
    await page.reload();
    await expect(page.getByLabel("書籍名")).toHaveValue(originalTitle);
  });
});
