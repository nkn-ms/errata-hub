import { expect, type Page } from "@playwright/test";

// 投稿は2段（フォームの「確認する」→ 確認画面の「投稿する」）。
// 投稿を作る spec がそれぞれ2手を書くと段の増減のたびに全 spec を直すことになるので、ここに寄せる。
//
// ⚠️ 入力エラーを見る spec はこれを使わない。エラーはフォームの側で出て確認画面まで進まないため、
//    そちらは「確認する」を押すところで止める（この関数は確認画面が出ることを前提にしている）。
export async function confirmAndSubmit(page: Page) {
  await page.getByRole("button", { name: "確認する" }).click();
  // 確認画面に入れたことを確かめてから押す。入力エラーで止まっていた場合、
  // ここを飛ばすとヘッダーの「投稿する」リンクを掴んで別の失敗に化ける
  await expect(page.getByRole("heading", { name: "この内容で投稿します" })).toBeVisible();
  await page.getByRole("button", { name: "投稿する" }).click();
}
