import { expect, type Locator, type Page } from "@playwright/test";

// 「投稿タイトルから、その投稿を探して詳細ページを開く」導線をここに集約する。
//
// トップは新着カード／削ぎ落としテーブルのフィードで、検索は `/reports` へ委譲される
// （トップの検索ボックスは `/reports?q=` へ飛ばす GET フォーム）。トップ上で一覧を絞り込むことは
// できないので、投稿の検索はテストからも `/reports?q=` を使う。

/** 検索一覧（/reports）で投稿タイトルを検索し、その行を返す */
export function findReportRow(page: Page, title: string): Locator {
  return page.getByRole("row").filter({ hasText: title });
}

/** /reports?q=<title> を開き、該当行が1件だけ出ている状態にする */
export async function searchReports(page: Page, title: string): Promise<Locator> {
  await page.goto(`/reports?q=${encodeURIComponent(title)}`);
  const row = findReportRow(page, title);
  await expect(row).toHaveCount(1);
  return row;
}

/**
 * 投稿タイトルで検索して詳細ページを開き、投稿 id を返す。
 * 行クリックでの遷移（ReportTable の tr onClick）も同時に検証している。
 */
export async function openReportByTitle(page: Page, title: string): Promise<string> {
  const row = await searchReports(page, title);
  // リンクを含まないセル（位置など）を押す。書籍名・投稿者はセル内リンクなので、
  // そこを押すと行クリック（tr onClick）ではなくリンク側の遷移になる
  await row.locator("td:not(:has(a))").first().click();
  await page.waitForURL(/\/reports\/[^/]+$/);
  return page.url().split("/").pop()!;
}
