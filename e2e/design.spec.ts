import { test, expect } from "@playwright/test";
import { routes } from "../src/constants/routes";

// デザインシステムのページ。読み取りだけなので既定（chromium）で回す。
//
// 何を守るか: このページは「実装の見本」なので、部品の描画が壊れると
// **説明だけが残って実物が消える**（もっとも困る壊れ方）。見出しではなく
// 見本そのものの数を数える。

test.describe("デザインシステム", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.design);
  });

  test("グレーの梯子が10段そろっている", async ({ page }) => {
    // 数を数えるのは、CSS 変数が消えても見た目が「白い四角」になるだけで気づけないため。
    // ⚠️ 色つきの段は並べない: Tailwind v4 は使われている色の変数しか出力しないので、
    //    使っていない段は解決できず空白になる（壊れて見える）。
    await expect(page.locator('[data-swatch]')).toHaveCount(10);
  });

  test("ステータスは定義されている数だけ並ぶ", async ({ page }) => {
    // 値が増減したらこのページも直す必要がある、を検知する。
    // ⚠️ StatusBadge に data-testid は渡せない（ハイフン付きの JSX 属性は tsc を素通りするが、
    //    受け取り側が DOM へ流していないので消える）。囲みの直下を数える。
    const badges = page.locator("[data-status-samples] > *");
    await expect(badges).toHaveCount(8);
  });

  test("見本の部品が実物として描かれている", async ({ page }) => {
    // 投稿の表（TanStack）・カード・賛同ボタン・テーマ切り替え
    await expect(page.getByRole("combobox", { name: "種別で絞り込む" })).toBeVisible();
    await expect(page.getByRole("button", { name: "自分も見つけた" })).toBeVisible();
    await expect(page.getByRole("button", { name: "メニュー（見本）" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "見本の絞り込み" })).toBeVisible();
  });

  test("ページに横スクロールを作らない", async ({ page }) => {
    // 色見本を横に並べるので、はみ出しやすい
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
