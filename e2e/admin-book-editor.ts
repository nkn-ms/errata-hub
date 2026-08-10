import { expect, type Page } from "@playwright/test";

/**
 * 書籍一覧から目当ての本の編集画面（/admin/books/[id]）を開く。
 * 書籍IDはシードごとに変わるので、一覧の行を書名で引いてから遷移する。
 */
export async function openBookEditor(page: Page, title: string) {
  await page.goto("/admin/books");
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("link", { name: "編集" })
    .click();
  await page.waitForURL(/\/admin\/books\/[0-9a-f-]+$/);
}

/** 書籍編集画面で正誤表URLを更新する（空文字なら登録を外す） */
export async function saveErratumUrl(page: Page, url: string) {
  await page.getByLabel("正誤表URL").fill(url);
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByText("更新しました")).toBeVisible();
}
