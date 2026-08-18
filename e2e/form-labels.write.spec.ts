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

    // 書籍の検索欄。ラベルは <label> ではなく role="group" の見出し（span#book-label）で、
    // BookSearch 側が aria-labelledby でそれを指している。
    // ⚠️ ここが抜けていたため、入力欄が「編集テキスト」としか読まれない状態に長く気づけなかった。
    // ⚠️ ここだけ getByLabel でなく getByRole を使う。同じ id を group も指しているため
    //    getByLabel だと group と入力欄の2つに当たって strict mode で落ちる。
    //    必須マーク（*）を名前に含むので前方一致で引く。
    const bookField = page.getByRole("textbox", { name: /^書籍名/ });
    // ISBN 検索（既定モード）で名前が付いていること
    await bookField.fill("9784873116860");
    await expect(bookField).toHaveValue("9784873116860");

    // タイトル検索へ切り替えても同じ名前で引ける（入力欄は別物なので個別に紐づけが要る）
    await page.getByRole("button", { name: "タイトルで検索" }).click();
    await expect(page.getByRole("textbox", { name: /^書籍名/ })).toBeVisible();

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

// 絞り込みバーは <label> を持たず、placeholder と先頭の option が見た目のラベルを兼ねている。
// どちらも名前にならないので（placeholder は打つと消え、option は値であって名前ではない）、
// 部品ごとに aria-label を付けてある。
//
// ⚠️ ここは axe（@axe-core/playwright）で1回スキャンして見つけた。列挙式のこのファイルが
//    3回続けて見落としていた場所＝上の「書籍名」と同じ種類の穴。
test.describe("絞り込みバーの部品に名前が付いている", () => {
  test("/reports の検索欄と2つの絞り込み", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("textbox", { name: "書籍名・タイトルで検索" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "種別で絞り込む" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "ステータスで絞り込む" })).toBeVisible();
  });

  test("/admin/logs の絞り込み", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/logs");
    await expect(page.getByRole("combobox", { name: "操作で絞り込む" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "メールアドレスで絞り込む" })).toBeVisible();
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
