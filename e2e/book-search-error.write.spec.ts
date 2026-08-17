import { test, expect } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// タイトル検索が失敗したときの表示。
//
// なぜ e2e なのか: 「0件」と「失敗」を混同すると**検索が壊れているのに『見つかりません』**と
// 出る（＝その本が無いと読める）。実際に本番で Google Books の 503 を踏んでこうなっていた。
// fetch は 5xx でも例外にならないので、res.ok の検査を外しても型検査もテストも通ってしまい、
// 表示だけが静かに嘘に戻る。だから画面の文言そのものを assertion にする。
test.describe("タイトル検索の失敗表示（書き込み・ログイン必須）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, READER);
  });

  test("上流が失敗したら「見つかりません」ではなく失敗として伝える", async ({ page }) => {
    await page.route("**/api/books/search*", (route) =>
      route.fulfill({
        status: 502,
        json: { error: "書籍検索に失敗しました。しばらくしてからお試しください。" },
      })
    );

    await page.goto("/submit");
    await page.getByRole("button", { name: "タイトルで検索" }).click();
    await page.getByPlaceholder("書籍名・著者名で検索...").fill("web");

    await expect(
      page.getByText("書籍検索に失敗しました。しばらくしてからお試しください。")
    ).toBeVisible();
    // 「その本は無い」と読める文言を出していないこと（ここが本題）
    await expect(page.getByText("見つかりません。")).toHaveCount(0);
  });

  test("レート制限のときはサーバーの文言（待ち時間つき）をそのまま出す", async ({ page }) => {
    // 汎用の文言に置き換えると「あと何秒待てばよいか」が落ちるので、サーバー側を優先する
    await page.route("**/api/books/search*", (route) =>
      route.fulfill({ status: 429, json: { error: "操作が多すぎます。1分ほど待ってからお試しください。" } })
    );

    await page.goto("/submit");
    await page.getByRole("button", { name: "タイトルで検索" }).click();
    await page.getByPlaceholder("書籍名・著者名で検索...").fill("web");

    await expect(page.getByText("操作が多すぎます。1分ほど待ってからお試しください。")).toBeVisible();
  });

  test("ISBN 検索も、取得の失敗を「ISBNをご確認ください」にしない", async ({ page }) => {
    await page.route("**/api/books/openbd*", (route) =>
      route.fulfill({
        status: 502,
        json: { error: "書籍情報の取得に失敗しました。しばらくしてからお試しください。" },
      })
    );

    await page.goto("/submit");
    // ISBN 検索は既定のモードなので切り替えは要らない
    await page.getByPlaceholder("例: 9784873116860").fill("9784873116860");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(
      page.getByText("書籍情報の取得に失敗しました。しばらくしてからお試しください。")
    ).toBeVisible();
    // 利用者の入力が悪いことにしていないこと（ここが本題）
    await expect(page.getByText("ISBNをご確認ください")).toHaveCount(0);
  });

  test("成功して0件のときは従来どおり「見つかりません」を出す", async ({ page }) => {
    await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));

    await page.goto("/submit");
    await page.getByRole("button", { name: "タイトルで検索" }).click();
    await page.getByPlaceholder("書籍名・著者名で検索...").fill("web");

    await expect(page.getByText("見つかりません。")).toBeVisible();
    await expect(
      page.getByText("検索に失敗しました。しばらくしてからお試しください。")
    ).toHaveCount(0);
  });
});
