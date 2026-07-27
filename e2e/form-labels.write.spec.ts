import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// フォームのラベルが入力欄と紐づいていることの回帰テスト。ローカル限定（write-local project）。
//
// なぜ必要か: ラベルが紐づいていないと、スクリーンリーダーで入力欄の項目名が読まれず
// 「編集テキスト」としか案内されない。見た目では気づけない壊れ方なので、テストで担保する。
// getByLabel は「ラベルと入力欄が実際に結び付いているか」を DOM から解決するので、
// これが通ること自体が紐づけの証明になる（htmlFor/id・入れ子・aria-labelledby のいずれでも可）。
//
// 何も保存しないので、シードの状態は変わらない。

test.describe("投稿フォームのラベル", () => {
  test("入力欄がラベルから引ける", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");

    // 紙の書籍を選ぶと版・ページなどの入力欄が出る
    await expect(page.getByLabel("タイトル")).toBeVisible();
    // 「版」は必須マーク（*）を含むので前方一致で引く。隣の「刷（任意）」と取り違えないこと
    await expect(page.getByLabel(/^版/)).toBeVisible();
    await expect(page.getByLabel("刷（任意）", { exact: true })).toBeVisible();
    await expect(page.getByLabel("備考（任意）", { exact: true })).toBeVisible();
    await expect(page.getByLabel("出版社の正誤表URL（任意）")).toBeVisible();

    // 実際に値が入る（＝ラベルが指しているのが目当ての入力欄であることの確認）
    await page.getByLabel("タイトル").fill("ラベル紐づけの確認");
    await expect(page.getByLabel("タイトル")).toHaveValue("ラベル紐づけの確認");
  });

  test("ボタン群には role=group で名前が付く（ラベルが単一の入力欄を指さない箇所）", async ({
    page,
  }) => {
    await login(page, READER);
    await page.goto("/submit");

    // 「読んだ媒体」「種別」は入力欄ではなくボタンの集まりなので、<label> ではなく
    // 名前つきのグループとして支援技術に伝える
    await expect(page.getByRole("group", { name: "読んだ媒体" })).toBeVisible();
    await expect(page.getByRole("group", { name: "種別" })).toBeVisible();
  });
});

test.describe("管理画面のフォームのラベル", () => {
  test("出版社フォームの入力欄がラベルから引ける", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/publishers/new");

    await page.getByLabel("出版社名").fill("ラベル確認社");
    await expect(page.getByLabel("出版社名")).toHaveValue("ラベル確認社");
    await expect(page.getByLabel("メールドメイン")).toBeVisible();
    await expect(page.getByLabel("備考", { exact: true })).toBeVisible();
    // 保存はしない（シードの出版社一覧を変えない）
  });

  test("書籍編集フォームの入力欄がラベルから引ける", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/books");
    await page.getByRole("link", { name: "編集" }).first().click();
    await page.waitForURL(/\/admin\/books\/[0-9a-f-]+$/);

    await expect(page.getByLabel("ISBN（変更不可）")).toBeVisible();
    await expect(page.getByLabel("書籍名")).toBeVisible();
    await expect(page.getByLabel("正誤表URL（出版社の公式ページ）")).toBeVisible();
    // 保存はしない（シードの書籍を変えない）
  });
});
