import { test, expect, type Page } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { findLowContrastText, formatFindings } from "./contrast";

// 投稿フォーム（/submit）の文字コントラスト（WCAG AA）。ログインが要る画面なので
// write-local project に置く（このテスト自体は何も書き込まない）。
//
// なぜ別ファイルか: /submit は「必須マーク *」「媒体・種別で入れ替わる欄」「送信エラーの帯」など、
// ページを開いただけでは描画されない文字が多い。goto して1回測るだけの contrast.spec.ts の形では
// 穴が残る——実際その穴のせいで必須マーク（旧 text-red-500 = 白地 3.82:1）が検査をすり抜けていた。
// ここでは状態を切り替えながら測る。判定の詳細は ./contrast.ts。

// 確認画面まで進むには書籍を選ぶ必要がある。書誌APIの応答は他の書き込み spec と同じ形で差し替える
// （外部依存を持ち込まない）。ここで選ぶ本は表示されるだけで、投稿は作らない
const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

async function expectAllTextMeetsAA(page: Page, state: string) {
  const findings = await findLowContrastText(page);
  expect(findings, `${state}:\n${formatFindings(findings)}`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`文字コントラスト（投稿フォーム・${colorScheme === "light" ? "ライト" : "ダーク"}）`, () => {
    test.use({ colorScheme });

    test("媒体・種別・エラーの各状態で全テキストが AA を満たす", async ({ page }) => {
      await login(page, READER);
      await page.goto("/submit");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // 媒体・種別のボタンは transition-colors で色が変わる。遷移の途中で測ると中間色を拾い、
      // 同じ操作でも 4.22:1 → 1.01:1 と毎回違う結果になる（実測）。見たいのは遷移後の状態なので、
      // 測定中だけ遷移を止める。以降このページから遷移しないので <style> は残り続ける
      await page.addStyleTag({
        content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
      });

      // 既定＝紙の書籍 × 正誤情報（必須マーク・版・ページ番号・誤/正）
      await expectAllTextMeetsAA(page, "既定（紙の書籍・正誤情報）");

      await page.getByLabel("複数ページにまたがる").check();
      await expectAllTextMeetsAA(page, "複数ページにまたがる（ページ範囲の注記）");

      await page.getByRole("button", { name: "改善提案" }).click();
      await expectAllTextMeetsAA(page, "種別＝改善提案（内容・提案）");

      await page.getByRole("button", { name: "電子書籍" }).click();
      await expectAllTextMeetsAA(page, "媒体＝電子書籍（位置・更新時期の注記）");

      await page.getByRole("button", { name: "その他（PDF・Web資料など）" }).click();
      await expectAllTextMeetsAA(page, "媒体＝その他（位置メモ）");

      // 未入力のまま「確認する」を押すとエラー帯（bg-red-50）が出る。書籍未選択の時点で弾かれるので
      // 確認画面にも進まない＝この操作で投稿は作られない。
      // 検証は全項目まとめて出すので、ここで測るのは**箇条書き＋該当欄へのリンク（下線つき）**の状態
      // ＝地が bg-red-50 の上の text-red-700。1件だけの帯より条件が厳しい
      await page.getByRole("button", { name: "確認する" }).click();
      await expect(page.getByText("書籍を選択してください")).toBeVisible();
      await expect(page.locator('form [role="alert"]').getByRole("listitem").first()).toBeVisible();
      await expectAllTextMeetsAA(page, "送信エラーの帯（全件の箇条書き＋リンク）");

      // 確認画面はフォームと入れ替わる別の画面（ラベルは gray-500・値は gray-900）なので、
      // ここまでの測定では1文字も見ていない。書籍を選んで必須を埋め、進んだ先も測る
      await mockBookApis(page);
      await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
      await page.getByRole("button", { name: "検索", exact: true }).click();
      await expect(page.getByText(BOOK_B.title)).toBeVisible();
      // ここまでの測定で媒体＝その他・種別＝改善提案に切り替わっているので、既定へ戻してから埋める
      await page.getByRole("button", { name: "紙の書籍" }).click();
      await page.getByRole("button", { name: "正誤情報" }).click();
      await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
      await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
      await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill("E2Eコントラスト確認");
      await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
      await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");
      await page.getByRole("button", { name: "確認する" }).click();
      await expect(page.getByRole("heading", { name: "この内容で投稿します" })).toBeVisible();
      await expectAllTextMeetsAA(page, "確認画面");
    });
  });
}
