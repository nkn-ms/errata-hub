import { expect, type Page } from "@playwright/test";

// 未ログインで見える公開側ヘッダーの中身。header-consistency.spec.ts（通常のページ）と
// not-found.spec.ts（404）が同じ契約を見るために共有する。
//
// ナビ項目は sm 以上でインライン表示（sm 未満はハンバーガー）。既定ビューポートは Desktop なので
// そのまま見える。
export async function expectPublicHeader(page: Page) {
  const header = page.getByRole("banner");

  await expect(header.getByText("Errata Hub")).toBeVisible();
  await expect(header.getByRole("button", { name: /表示テーマ/ })).toBeVisible();
  await expect(header.getByRole("link", { name: "使い方" })).toBeVisible();
  await expect(header.getByRole("link", { name: "使用技術" })).toBeVisible();
  await expect(header.getByRole("link", { name: "会員登録" })).toBeVisible();
  await expect(header.getByRole("link", { name: "ログイン" })).toBeVisible();
  await expect(header.getByRole("link", { name: "投稿する" })).toBeVisible();
}
