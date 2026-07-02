import { test as setup, expect } from "@playwright/test";

// ログイン状態を1回だけ作り、storageState（クッキー類）をファイルに保存する準備処理。
// 各認証テストはこの状態を読み込んで「最初からログイン済み」で始まる（毎回ログインしない）。
//
// 確認メールのクリックは自動化が難しいため、登録フローは通さず、
// 事前に用意した「確認済みテストアカウント」でログインだけ行う。
// 認証情報は .env.e2e（gitignore 済み）から渡す。playwright.config.ts 側で、
// 認証情報が無いときはこの project 自体を実行しない（既定スイートは緑のまま）。
const authFile = "e2e/.auth/user.json";

setup("ログイン状態を保存する", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD が未設定です（.env.e2e を参照）");
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン成功でトップ（/）にリダイレクトする（失敗時は /login に留まる）。
  // ログアウトはユーザーメニュー内に移動したため、成功判定は URL と
  // 「ログイン」リンクの消失で行う（ヘッダーが未ログイン用リンクを出さない＝ログイン済み）。
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "ログイン" })).toHaveCount(0);

  await page.context().storageState({ path: authFile });
});
