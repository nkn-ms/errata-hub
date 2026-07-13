import { test, expect, type Page } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// 公開リンク（GitHub / X）の書き込み系 e2e。ローカル dev＋ローカル Supabase 限定
// （playwright.config.ts の write-local project）。前提は他の書き込みテストと同じ:
// `supabase start` ＋ `npm run seed:local` 済みであること。

// Supabase の auth cookie（sb-*-auth-token、大きいと .0/.1 に分割される）から
// 自分の user id を取り出す。UI に自分のユーザーページへの導線がまだ無く、
// /users/[id] の表示確認に id が必要なため。
async function getMyUserId(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const joined = cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => decodeURIComponent(c.value))
    .join("");
  const b64 = joined.replace(/^base64-/, "");
  const session = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
    user: { id: string };
  };
  return session.user.id;
}

async function saveLinks(page: Page, github: string, x: string) {
  await page.goto("/account");
  await page.locator("#githubUsername").fill(github);
  await page.locator("#xUsername").fill(x);
  await page.getByRole("button", { name: "公開リンクを保存" }).click();
}

test.describe("公開リンク（書き込み）", () => {
  test("設定すると公開ページに表示され、空欄で保存すると非公開に戻る", async ({ page }) => {
    await login(page, READER);
    const userId = await getMyUserId(page);

    // 設定（X は @ 付きで入力しても剥がして保存される）
    await saveLinks(page, "octocat", "@jack");
    await expect(page.getByText("公開リンクを更新しました")).toBeVisible();

    await page.goto(`/users/${userId}`);
    await expect(page.getByRole("link", { name: "octocat" })).toHaveAttribute(
      "href",
      "https://github.com/octocat"
    );
    await expect(page.getByRole("link", { name: "@jack" })).toHaveAttribute(
      "href",
      "https://x.com/jack"
    );

    // 後片付け兼テスト: 空欄保存で非公開（シードの初期状態）に戻す
    await saveLinks(page, "", "");
    await expect(page.getByText("公開リンクを更新しました")).toBeVisible();

    await page.goto(`/users/${userId}`);
    await expect(page.getByRole("link", { name: "octocat" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "@jack" })).toHaveCount(0);
  });

  test("不正な形式のユーザー名はエラーになり保存されない", async ({ page }) => {
    await login(page, READER);
    await saveLinks(page, "-bad-name", "");
    await expect(
      page.getByText(/GitHubのユーザー名の形式が正しくありません/)
    ).toBeVisible();
  });
});
