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

      // 未入力のまま送信するとエラー帯（bg-red-50）が出る。書籍未選択の時点で弾かれるので
      // サーバーには何も送られない＝この操作で投稿は作られない
      await page.getByRole("button", { name: "投稿する" }).click();
      await expect(page.getByText("書籍を選択してください")).toBeVisible();
      await expectAllTextMeetsAA(page, "送信エラーの帯");
    });
  });
}
