import { test, expect } from "@playwright/test";

// 認証エラー画面（app/auth/error/page.tsx）。?reason= で文言を切り替える。
//
// 見るのは「知らない reason でも既定の文言に落ちること」。**?reason= は URL に直接書ける**ので、
// 送り元（/auth/callback）が渡す値だけを想定してはいけない。
//
// ⚠️ このフォールバックは型では守れない。REASONS の索引に `as keyof typeof REASONS` を掛けると
//    型は「必ず引ける」と嘘をつき、フォールバックが不要な分岐に見える
//    （実際 eslint の no-unnecessary-condition が「常に真」と報告した）。外すと undefined の
//    分割代入で例外になり、**エラー画面自身が 500 になる**。型が守れない以上、ここで固定する。
//
// 読み取り専用（未ログイン・DB を書かない）。

const DEFAULT_MESSAGE = "メール確認リンクが無効か期限切れです";
const CONFLICT_MESSAGE = "以前作成されたアカウントが使用中のため";

test.describe("認証エラー画面", () => {
  test("知らない reason でも 200 で既定の文言が出る（500 にしない）", async ({ page }) => {
    const res = await page.goto("/auth/error?reason=no-such-reason");

    expect(res?.status()).toBe(200);
    await expect(page.getByText(DEFAULT_MESSAGE)).toBeVisible();
  });

  test("reason 無しでも既定の文言が出る", async ({ page }) => {
    const res = await page.goto("/auth/error");

    expect(res?.status()).toBe(200);
    await expect(page.getByText(DEFAULT_MESSAGE)).toBeVisible();
  });

  test("知っている reason では専用の文言に切り替わる", async ({ page }) => {
    await page.goto("/auth/error?reason=email-conflict");

    await expect(page.getByText(CONFLICT_MESSAGE)).toBeVisible();
    // 既定の文言に落ちていないこと（切り替わりの確認）
    await expect(page.getByText(DEFAULT_MESSAGE)).toHaveCount(0);
  });
});
