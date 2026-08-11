import { expect, type Page } from "@playwright/test";

/**
 * 書籍一覧から目当ての本の編集画面（/admin/books/[id]）を開く。
 * 書籍IDはシードごとに変わるので、一覧の行を引いてから遷移する。
 *
 * ⚠️ **引くのは ISBN（書名ではない）。** 書名は重複しうる（同じ本の別 ISBN が
 * ローカルに増えるだけで行が2つ当たり、strict mode violation で落ちる＝実際に落ちた）。
 * ISBN は本の同一性の基準で一意 = decision-isbn-required / schema.prisma。
 */
export async function openBookEditor(page: Page, isbn: string) {
  await page.goto("/admin/books");
  await page
    .getByRole("row")
    .filter({ hasText: isbn })
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
