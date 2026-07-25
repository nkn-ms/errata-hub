import { test, expect } from "@playwright/test";

// 読み取り専用スモークテスト。
// 本番 Supabase に接続するため、ここでは表示・遷移・バリデーションのみを確認し、
// 会員登録・ログイン・投稿などの「書き込み」は一切行わない（本番DBを汚さない）。

test.describe("トップページ", () => {
  test("最新の投稿が表示され、免責バナーとナビが出る", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "最新の投稿" })).toBeVisible();
    await expect(
      page.getByText("出版社による確認が完了していない", { exact: false })
    ).toBeVisible();

    // 未ログイン時のナビ
    await expect(page.getByRole("link", { name: "投稿する" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
    await expect(page.getByRole("link", { name: "会員登録" })).toBeVisible();
  });

  test("ログインリンクから /login に遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("PC ではテーブルで一覧が出て、行から投稿詳細 /reports/[id] へ遷移する", async ({ page }) => {
    await page.goto("/");
    // 既定ビューポート（Desktop）ではテーブル表示（カードは md:hidden で隠れる）
    await expect(page.locator("table")).toBeVisible();
    const rows = page.locator("table tbody tr");
    test.skip((await rows.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");

    // 行の書籍リンク（行いっぱいに広げた stretched link）で詳細へ
    await rows.first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/reports\/[^/]+$/);
  });

  test("スマホではカードで一覧が出て、カードから投稿詳細 /reports/[id] へ遷移する", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto("/");
    // md 未満ではカード表示（テーブルは hidden md:block で隠れる）。カードは投稿詳細への <a>
    const cards = page.locator('main a[href^="/reports/"]');
    test.skip((await cards.count()) === 0, "投稿データが0件のためスキップ（フィードが空）");

    await cards.first().click();
    await expect(page).toHaveURL(/\/reports\/[^/]+$/);
  });

  test("検索ボックスから /reports?q= に委譲される", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "投稿を検索" }).fill("TCP");
    await page.getByRole("button", { name: "検索" }).click();
    // トップは眺める場所。絞り込みは一覧ページ /reports に渡す（q はそこで初期検索語になる）
    await expect(page).toHaveURL(/\/reports\?q=TCP$/);
    await expect(page.getByRole("heading", { name: "すべての投稿" })).toBeVisible();
  });

  test("ページ送り（?page=N）が表示される", async ({ page }) => {
    await page.goto("/");
    // 「n / m ページ」と前後リンクが出る。1ページに収まる場合でも表示自体は出る。
    await expect(page.getByText(/\d+ \/ \d+ ページ/)).toBeVisible();
    await expect(page.getByText("古い投稿", { exact: false })).toBeVisible();
    await expect(page.getByText("新しい投稿", { exact: false })).toBeVisible();
  });

  test("範囲外の ?page=N は最後の有効ページへリダイレクトされる", async ({ page }) => {
    // 古いリンク・打ち間違いで空スライスを引き「まだ投稿はありません」を誤表示しない担保。
    await page.goto("/?page=9999");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "最新の投稿" })).toBeVisible();
  });
});

test.describe("ログインページ", () => {
  test("フォームの要素が揃っている", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("会員登録リンクから /register に遷移できる", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "会員登録" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe("会員登録ページ", () => {
  test("フォームの要素が揃っている", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "会員登録" })).toBeVisible();
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "会員登録" })).toBeVisible();
  });
});

test.describe("認可ゲート（proxy.ts）", () => {
  test("未ログインで /submit にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("未ログインで /admin にアクセスすると /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("投稿一覧ページ（/reports）", () => {
  test("トップの検索テーブルは /reports へ引っ越している（フィルタバーが出る）", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "すべての投稿" })).toBeVisible();
    await expect(page.getByPlaceholder("書籍名・タイトルで検索...")).toBeVisible();
    await expect(page.getByRole("option", { name: "種別：すべて" })).toBeAttached();
    await expect(page.getByText(/\d+ 件/)).toBeVisible();
  });

  test("行をクリックすると投稿詳細 /reports/[id] に遷移する", async ({ page }) => {
    await page.goto("/reports");
    // テーブルの描画完了を待ってから件数を見る（クライアント描画の取りこぼし防止）。
    await expect(page.getByText(/\d+ 件/)).toBeVisible();
    const rows = page.locator("tbody tr");
    test.skip((await rows.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");

    // リンクを含まないセル（位置など）を選ぶ。リンクの上を押すとそちらの遷移になるため、
    // 行クリック（router.push）を試すにはリンクの無いセルが要る
    await rows.first().locator("td:not(:has(a))").first().click();
    await expect(page).toHaveURL(/\/reports\/[^/]+$/);
  });

  test("書籍名リンクから書籍ページ /books/[isbn] に遷移する", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/\d+ 件/)).toBeVisible();
    const bookLinks = page.locator('tbody a[href^="/books/"]');
    test.skip((await bookLinks.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");

    await bookLinks.first().click();
    // 書籍 URL は UUID ではなく ISBN-13。公開後に変えられない URL を自然キーに固定する担保
    await expect(page).toHaveURL(/\/books\/97\d{11}$/);
  });

  test("?q= が初期検索語として反映される", async ({ page }) => {
    await page.goto("/reports");
    const bookLinks = page.locator('tbody a[href^="/books/"]');
    test.skip((await bookLinks.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");
    // トップの検索ボックス相当。URL の q が検索入力に入り、テーブルが絞り込まれる。
    await page.goto("/reports?q=TCP");
    await expect(page.getByPlaceholder("書籍名・タイトルで検索...")).toHaveValue("TCP");
  });

  test("非正規な ISBN の書籍 URL は正規の ISBN-13 へ寄せられる", async ({ page }) => {
    await page.goto("/reports");
    const bookLinks = page.locator('tbody a[href^="/books/"]');
    test.skip((await bookLinks.count()) === 0, "投稿データが0件のためスキップ（一覧が空）");

    const canonical = (await bookLinks.first().getAttribute("href"))!;
    // 同じ本をハイフン入りで指しても、1冊=1 URL になるよう正規形へリダイレクトされる
    const hyphenated = canonical.replace(/^\/books\/(\d{3})(\d)(\d{4})(\d{4})(\d)$/, "/books/$1-$2-$3-$4-$5");
    expect(hyphenated).not.toBe(canonical);

    await page.goto(hyphenated);
    await expect(page).toHaveURL(canonical);
  });
});

test.describe("情報ページ", () => {
  test("使い方ページが開ける", async ({ page }) => {
    const res = await page.goto("/how-to-use");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/使い方/);
  });

  test("使用技術ページが開ける", async ({ page }) => {
    const res = await page.goto("/tech");
    expect(res?.status()).toBeLessThan(400);
  });
});

test.describe("検索エンジン向けのファイル", () => {
  test("sitemap.xml が公開ページだけを列挙する", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    // 静的な公開ページは必ず載る（/reports = 投稿の検索・一覧ページも含む）
    for (const path of ["/reports", "/how-to-use", "/tech", "/terms", "/privacy"]) {
      expect(xml).toContain(`${path}</loc>`);
    }
    // 書籍は ISBN URL で載る（UUID が漏れていないことの担保も兼ねる）
    expect(xml).toMatch(/<loc>[^<]*\/books\/97\d{11}<\/loc>/);

    // ログイン必須・認証フロー・プロフィールは載せない
    for (const excluded of ["/admin", "/account", "/auth/", "/submit", "/login", "/register", "/users/"]) {
      expect(xml).not.toContain(excluded);
    }
  });

  test("robots.txt が sitemap の場所を示す", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Sitemap: ");
  });

  test("トップページの lang が ja になっている", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });
});

test.describe("存在しないルート", () => {
  test("404 を返す", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist-xyz");
    expect(res?.status()).toBe(404);
  });
});
