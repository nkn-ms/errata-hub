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
      route.fulfill({ status: 502, json: { error: "書籍検索に失敗しました" } })
    );

    await page.goto("/submit");
    await page.getByRole("button", { name: "タイトルで検索" }).click();
    await page.getByPlaceholder("書籍名・著者名で検索...").fill("web");

    await expect(page.getByText("検索に失敗しました。しばらくしてからお試しください。")).toBeVisible();
    // 「その本は無い」と読める文言を出していないこと（ここが本題）
    await expect(page.getByText("見つかりません。")).toHaveCount(0);
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
