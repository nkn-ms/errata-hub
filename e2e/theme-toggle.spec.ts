import { test, expect, type Page } from "@playwright/test";

// 表示テーマの手動切り替え（OS の設定 → ライト → ダーク の順送り）。
//
// 配色は globals.css の `:root[data-theme="dark"]` だけが持ち、OS 追従も含めて
// 「誰が data-theme を書くか」で決まる設計（utils/theme.ts）。したがって検証も
// **data-theme と実際の計算値**を見る。クラス名を見ても何も分からない。

const toggle = (page: Page) => page.getByRole("button", { name: /表示テーマ/ });

async function resolvedTheme(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

async function storedChoice(page: Page) {
  return page.evaluate(() => localStorage.getItem("theme"));
}

/** body の背景の明るさ（0=黒 1=白）。テーマが実際に塗り替わったかを見る */
async function backgroundLuminance(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  });
}

test.describe("表示テーマの切り替え（OS はダーク）", () => {
  test.use({ colorScheme: "dark" });

  test("初期状態は OS 追従で、保存値は持たない", async ({ page }) => {
    await page.goto("/");

    expect(await resolvedTheme(page)).toBe("dark");
    expect(await storedChoice(page)).toBeNull();
    await expect(toggle(page)).toHaveAccessibleName(/OS の設定に合わせる/);
  });

  test("1回押すとライトになり、リロードしても戻らない", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();

    expect(await resolvedTheme(page)).toBe("light");
    expect(await storedChoice(page)).toBe("light");
    expect(await backgroundLuminance(page)).toBeGreaterThan(0.7);
    await expect(toggle(page)).toHaveAccessibleName(/ライト/);

    // 保存された選択は、描画前に走る初期化スクリプトが復元する（ちらつかせない）
    await page.reload();
    expect(await resolvedTheme(page)).toBe("light");
    await expect(toggle(page)).toHaveAccessibleName(/ライト/);
  });

  test("押し続けると ライト → ダーク → OS の設定 と一周する", async ({ page }) => {
    await page.goto("/");

    await toggle(page).click(); // ライト
    await toggle(page).click(); // ダーク
    expect(await resolvedTheme(page)).toBe("dark");
    expect(await storedChoice(page)).toBe("dark");
    expect(await backgroundLuminance(page)).toBeLessThan(0.1);

    await toggle(page).click(); // OS の設定に戻る
    expect(await resolvedTheme(page)).toBe("dark"); // OS がダークなので見た目はダークのまま
    expect(await storedChoice(page)).toBeNull(); // 保存値は消える（＝OS 追従の表し方）
    await expect(toggle(page)).toHaveAccessibleName(/OS の設定に合わせる/);
  });
});

test.describe("表示テーマの切り替え（OS はライト）", () => {
  test.use({ colorScheme: "light" });

  test("OS がライトでもダークを選べる（選択が OS より優先される）", async ({ page }) => {
    await page.goto("/");
    expect(await resolvedTheme(page)).toBe("light");

    await toggle(page).click(); // ライト（明示）
    await toggle(page).click(); // ダーク
    expect(await resolvedTheme(page)).toBe("dark");
    expect(await backgroundLuminance(page)).toBeLessThan(0.1);

    await page.reload();
    expect(await resolvedTheme(page)).toBe("dark");
  });

  test("トップ以外のページにもボタンがある（共通ヘッダーに置いてある）", async ({ page }) => {
    // ゲストで開ける＝共通ヘッダーが出るページから選ぶ（/submit はログインへ飛ぶので対象外）
    for (const path of ["/reports", "/how-to-use", "/tech"]) {
      await page.goto(path);
      await expect(toggle(page)).toBeVisible();
    }
  });
});
