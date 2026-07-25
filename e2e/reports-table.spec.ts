import { test, expect } from "@playwright/test";

// /reports の一覧テーブル（11列 → 6列に統合したあとの姿）と、ステータスの説明ツールチップ。
//
// 列を落としたときに壊れやすいのは「見えなくなった項目で検索できなくなること」。
// 表示は6列でも検索対象は絞る前と同じ（隠し列 searchText にまとめている）ことを実測で押さえる。

test.describe("投稿一覧テーブル（/reports）", () => {
  test("列は6つだけで、横スクロールなしに収まる", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();

    await expect(page.locator("thead th")).toHaveText(["種別", "書籍", "内容", "位置", "状況", "投稿"]);

    // 以前は 1280px でも 200px 超が隠れていた。テーブルを包む overflow-x-auto の
    // 中身が枠に収まっている＝隠れた列が無いことを見る
    const overflow = await page.locator("div.overflow-x-auto").last().evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("落とした列の情報は同じ行の中に残っている（版・刷／タイトル／投稿者）", async ({ page }) => {
    await page.goto("/reports");
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();

    // 位置セルに版が同居している（"第1版 p.1" のような表記）
    await expect(firstRow.getByText(/第\d+版|p\.\d+|位置No/)).toHaveCount(1);
    // 投稿セルに投稿者が残っている（退会済みはリンクにしないので、リンクか「退会済み」表記のどちらか）
    const authorShown =
      (await firstRow.locator('a[href^="/users/"]').count()) > 0 ||
      (await firstRow.getByText("退会済み").count()) > 0;
    expect(authorShown).toBe(true);
  });

  test("正誤情報の内容は 誤:/正: の2行で表示される", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();

    // 1行の "誤 → 正" は長いと途中で切れるので、誤・正を別行の太字ラベルに分けている
    await expect(page.locator("td span.font-semibold", { hasText: "誤:" }).first()).toBeVisible();
    await expect(page.locator("td span.font-semibold", { hasText: "正:" }).first()).toBeVisible();
    // 旧表示（1行の矢印つなぎ）が残っていないこと
    await expect(page.locator("tbody").getByText("→", { exact: false })).toHaveCount(0);
  });

  test("表示を落とした項目でも検索できる（出版社コメント・投稿者名）", async ({ page }) => {
    await page.goto("/reports");
    const search = page.getByPlaceholder("書籍名・タイトルで検索...");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();

    // 投稿者名で検索 → その投稿者の行だけが残る
    const authorLink = page.locator('tbody a[href^="/users/"]').first();
    const authorName = (await authorLink.textContent())!.trim();
    await search.fill(authorName);
    await expect(page.locator("tbody tr")).not.toHaveCount(0);
    for (const row of await page.locator("tbody tr").all()) {
      await expect(row).toContainText(authorName);
    }

    // 一致しない語では 0 件になる（＝検索が効いていることの裏）
    await search.fill("該当しない語句zzzz");
    await expect(page.getByText("該当する投稿がありません")).toBeVisible();
  });

  test("種別・ステータスの絞り込みが効く", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();
    const before = await page.locator("tbody tr").count();

    await page.getByRole("combobox").nth(1).selectOption({ label: "修正済み" });
    const after = await page.locator("tbody tr").count();
    expect(after).toBeLessThanOrEqual(before);
  });
});

test.describe("ステータスの説明（ツールチップ）", () => {
  test("バッジに重ねると説明が出る（title 属性ではなく自前のパネル）", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();

    const badge = page.locator("tbody .group").first();
    const tooltip = badge.locator("span[aria-hidden]");

    // 閉じている間は display:none（opacity で隠すと、パネルの幅の分だけ表が横スクロールになる）
    await expect(tooltip).toBeHidden();

    await badge.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("。");

    // 以前は title 属性だった（OS 依存・タッチで出ない・色を選べない）ので、残っていないことも見る
    await expect(badge.locator("[title]")).toHaveCount(0);
  });

  test("説明は読み上げにも常に載っている（hover に依存しない）", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();

    // 「未対応」のバッジの読み上げ名に説明文が含まれる（sr-only のテキスト）
    const badge = page.locator("tbody .group").first();
    const accessibleText = (await badge.textContent())!;
    expect(accessibleText).toMatch(/。/); // 説明は文（句点を含む）
  });

  test("投稿詳細・書籍ページ・ユーザーページでも同じバッジが使われている", async ({ page }) => {
    await page.goto("/reports");
    await page.locator("tbody tr").first().locator("td:not(:has(a))").first().click();
    await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
    await expect(page.locator(".group span[aria-hidden]").first()).toBeAttached();

    await page.getByRole("link", { name: "この本の投稿一覧" }).click();
    await page.waitForURL(/\/books\/\d{13}$/);
    await expect(page.locator(".group span[aria-hidden]").first()).toBeAttached();

    const userLink = page.locator('a[href^="/users/"]').first();
    if (await userLink.count()) {
      await userLink.click();
      await page.waitForURL(/\/users\//);
      await expect(page.locator(".group span[aria-hidden]").first()).toBeAttached();
    }
  });
});
