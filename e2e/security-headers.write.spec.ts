import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";
import { watchCspViolations, formatViolations } from "./csp";

// セキュリティヘッダのうち、ログインが要る画面での CSP 違反検査。
// 書き込みはしないが、シードアカウントでのログインを伴うので write-local project に置く
// （contrast-admin.write.spec.ts と同じ理由）。
//
// ここを別に測る理由: 投稿フォームと管理画面は本文中でいちばん JS が濃い画面
// （書籍検索・画像プレビュー・テーブル操作）なので、CSP の緩和漏れが最初に出る場所。

const ADMIN_PAGES = ["/admin/reports", "/admin/books", "/admin/publishers", "/admin/users", "/admin/logs"];

test.describe("セキュリティヘッダ（ログイン後）", () => {
  test("投稿フォームと管理画面で CSP 違反が起きない", async ({ page }) => {
    const violations = await watchCspViolations(page);

    await login(page, ADMIN);
    let found = await violations();
    expect(found, `ログイン直後のトップ:\n${formatViolations(found)}`).toEqual([]);

    // 投稿フォーム（書籍検索・画像プレビューのクライアント JS が動く画面）
    await page.goto("/submit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    found = await violations();
    expect(found, `/submit:\n${formatViolations(found)}`).toEqual([]);

    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      found = await violations();
      expect(found, `${path}:\n${formatViolations(found)}`).toEqual([]);
    }
  });
});
