import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { createThrowawayAccount } from "./throwaway-user";

// 管理画面（書き込み）の e2e。ローカル dev＋ローカル Supabase 限定で実行される
// （playwright.config.ts の write-local project）。前提は他の書き込みテストと同じ:
// `supabase start` ＋ `npm run seed:local` 済みであること。
//
// PR#66 で API Route から Server Actions に移した更新系のうち、admin 系フローを固定する。
// いずれのテストも、最後にシードの初期状態へ戻してから終わる（繰り返し実行できる）。

const SEEDED_REPORT_TITLE = "サンプル投稿"; // シードが作る唯一の投稿（初期ステータス=未対応）
const SEED_PUBLISHER = "オーム社"; // シードが作る唯一の出版社

test.describe("認可（管理画面）", () => {
  test("一般ユーザーがログイン済みでも /admin には入れずトップに戻される", async ({ page }) => {
    await login(page, READER);

    await page.goto("/admin");

    // requireAdminPage（services/auth.ts）が ADMIN 以外を "/" に redirect する
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "投稿一覧" })).toBeHidden();
  });
});

test.describe("投稿のステータス更新（管理者）", () => {
  test("ステータスと出版社コメントを保存すると、公開ページに反映される", async ({ page }) => {
    const comment = `E2E 出版社コメント ${Date.now()}`;
    await login(page, ADMIN);

    await page.goto("/admin/reports");
    await page
      .getByRole("row")
      .filter({ hasText: SEEDED_REPORT_TITLE })
      .getByRole("link", { name: "詳細・編集" })
      .click();
    await page.waitForURL(/\/admin\/reports\/[0-9a-f-]+$/);
    const reportId = page.url().split("/").pop()!;

    await page.getByRole("button", { name: "修正済み", exact: true }).click();
    await page.getByPlaceholder("出版社からの回答や対応内容を記載してください").fill(comment);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    // 公開側の投稿詳細に反映されている（更新系が Server Action 経由でも読み取りに載ること）
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("修正済み")).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();

    // シードの初期状態（未対応・コメントなし）に戻す
    await page.goto(`/admin/reports/${reportId}`);
    await page.getByRole("button", { name: "未対応", exact: true }).click();
    await page.getByPlaceholder("出版社からの回答や対応内容を記載してください").fill("");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("未対応")).toBeVisible();
    await expect(page.getByText(comment)).toBeHidden();
  });
});

test.describe("出版社アクセスの付与・剥奪（管理者）", () => {
  test("一般ユーザーに出版社を付与でき、剥奪すると一覧から消える", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/users");
    await page
      .getByRole("row")
      .filter({ hasText: READER.email })
      .getByRole("link", { name: "編集" })
      .click();
    await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);

    await expect(page.getByText("付与された出版社なし")).toBeVisible();

    await page.getByRole("combobox").selectOption({ label: SEED_PUBLISHER });
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("追加しました")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: SEED_PUBLISHER })).toBeVisible();

    // 剥奪（＝シードの初期状態に戻す）
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByText("削除しました")).toBeVisible();
    await expect(page.getByText("付与された出版社なし")).toBeVisible();

    // 一覧側にも反映されている（付与列が "-" に戻る）
    await page.goto("/admin/users");
    const readerRow = page.getByRole("row").filter({ hasText: READER.email });
    await expect(readerRow).not.toContainText(SEED_PUBLISHER);
  });
});

test.describe("管理者による代行退会", () => {
  // ⚠️ 取り消せない操作なので、対象は必ず使い捨てアカウント（シード垢・管理者垢は絶対に使わない）。
  test("表示名を確認入力すると退会させられ、ログインできなくなる", async ({ page }) => {
    const account = await createThrowawayAccount();

    await login(page, ADMIN);
    await page.goto(`/admin/users/${account.id}`);

    // 確認入力が空／一致しないうちは押せない（押し間違いの砦）
    const withdrawButton = page.getByRole("button", { name: "退会させる" });
    await expect(withdrawButton).toBeDisabled();
    const confirmation = page.getByLabel(/入力してください/);
    await confirmation.fill(account.displayName.slice(0, -1));
    await expect(withdrawButton).toBeDisabled();

    await confirmation.fill(account.displayName);
    await expect(withdrawButton).toBeEnabled();
    await withdrawButton.click();

    // 成功すると一覧へ戻り、対象は匿名メールになっている（＝ Profile はスクラブ済みで残る）
    await page.waitForURL(/\/admin\/users$/);
    await expect(page.getByRole("row").filter({ hasText: account.email })).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: `deleted-${account.id}@deleted.local` })
    ).toBeVisible();

    // 操作ログに残る（誰が代行したかを後から追える）
    await page.goto("/admin/logs");
    await expect(page.getByRole("row").filter({ hasText: "退会（管理者代行）" }).first()).toBeVisible();

    // auth.users が消えているので、本人はもうログインできない
    await page.goto("/login");
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません")).toBeVisible();
  });

  test("管理者自身と他の管理者は退会させられない（理由が出て入力欄も出ない）", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/users");
    await page
      .getByRole("row")
      .filter({ hasText: ADMIN.email })
      .getByRole("link", { name: "編集" })
      .click();
    await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);

    await expect(page.getByText("自分自身を退会させることはできません。")).toBeVisible();
    await expect(page.getByRole("button", { name: "退会させる" })).toHaveCount(0);
    await expect(page.getByLabel(/入力してください/)).toHaveCount(0);
  });
});
