import { test, expect } from "@playwright/test";
import { expectPublicHeader } from "./site-header";

// 404 の画面（app/not-found.tsx）。見るのは3点:
//   ① 共通の枠（ヘッダー・フッター）の中に出ること。Next.js 既定の 404 は枠を持たないので、
//      訪問者はサイトから放り出され、戻る導線も無かった
//   ② notFound() 経由（存在しない書籍・投稿）でも同じ画面になること
//   ③ HTTP ステータスが 404 であること（soft 404 にしない）
//
// ⚠️ ③ は「本文のストリーミングが始まる前に notFound() へ到達したか」で決まる。将来
//    loading.tsx / Suspense を入れると 200＋noindex に変わり、このテストが落ちる。
//    そのときは仕様どおりの変化なので、期待値を 200 に直してよい（判断の根拠は
//    node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md「Status Codes」）。
//
// 読み取り専用（未ログイン・DB を書かない）。

// チェック数字が合わない ISBN。ページは DB を引く前に notFound() するので、
// 「投稿データが無くても必ず 404 になる」経路として使える（検算: 正しい末尾は 8）。
const INVALID_ISBN = "1234567890123";

// 形式は正しいが存在しない UUID（こちらは DB を引いた結果の 404）
const MISSING_REPORT_ID = "00000000-0000-0000-0000-000000000000";

test.describe("404 ページ", () => {
  test("未一致の URL で 404 が返り、共通の枠の中に案内が出る", async ({ page }) => {
    const res = await page.goto("/no-such-page");

    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();

    // 枠が付いていること（既定の 404 との違いはここ）
    await expectPublicHeader(page);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("トップへ戻る導線が効く", async ({ page }) => {
    await page.goto("/no-such-page");
    await page.getByRole("link", { name: "トップへ" }).click();

    // baseURL 直下（末尾が / だけ）に戻ったことを見る
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "最新の投稿" })).toBeVisible();
  });

  test("存在しない書籍（ISBN のチェック数字が不正）も同じ 404 になる", async ({ page }) => {
    const res = await page.goto(`/books/${INVALID_ISBN}`);

    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
    await expectPublicHeader(page);
  });

  test("存在しない投稿も同じ 404 になる", async ({ page }) => {
    const res = await page.goto(`/reports/${MISSING_REPORT_ID}`);

    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  });
});
