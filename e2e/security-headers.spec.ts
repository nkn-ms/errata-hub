import { test, expect } from "@playwright/test";
import { watchCspViolations, formatViolations } from "./csp";

// セキュリティヘッダの検査（読み取り専用）。
//
// 見ているのは2つ。「付いているか」と「厳しすぎて自分の画面を壊していないか」。
// 後者が本番で起きると画面が真っ白・ボタンが無反応という形で出るので、
// 主要ページを実ブラウザで開いて CSP 違反が0件であることを確かめる。
//
// 値の設計理由は src/utils/security-headers.ts、nonce の配り方は src/proxy.ts。

// ゲストで開ける主要ページ（ログインが要る画面は security-headers.write.spec.ts 側）
const GUEST_PAGES = [
  "/",
  "/reports",
  "/how-to-use",
  "/tech",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/account/withdrawn",
];

test.describe("セキュリティヘッダ", () => {
  test("固定ヘッダと CSP が付いている", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");

    // 使用フレームワークを名乗らない（next.config.ts の poweredByHeader: false）
    expect(headers["x-powered-by"]).toBeUndefined();

    const csp = headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    // script-src に unsafe-inline があると nonce 方式が無意味になる（style-src は別途許容）
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  test("nonce はリクエストごとに変わる", async ({ request }) => {
    const nonceOf = async () => {
      const csp = (await request.get("/")).headers()["content-security-policy"];
      return csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
    };

    const first = await nonceOf();
    expect(first).toBeTruthy();
    expect(await nonceOf()).not.toBe(first);
  });

  for (const path of GUEST_PAGES) {
    test(`${path} で CSP 違反が起きない`, async ({ page }) => {
      const violations = await watchCspViolations(page);
      await page.goto(path);
      // hydration まで待つ（スクリプトのブロックはここで初めて出る）
      await expect(page.getByRole("contentinfo")).toBeVisible();

      const found = await violations();
      expect(found, `CSP 違反:\n${formatViolations(found)}`).toEqual([]);
    });
  }

  test("違反の検出そのものが効いている", async ({ page }) => {
    // 上の「違反0件」検査は、収集の仕込みが壊れていても緑になってしまう。
    // 許可していないホストの画像を1枚差し込んで、ちゃんと検出されることを確かめる
    // （CSP でブロックされるので外部への通信は発生しない）。
    const violations = await watchCspViolations(page);
    await page.goto("/");
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "https://blocked.example/pixel.png";
      document.body.appendChild(img);
    });

    await expect.poll(async () => (await violations()).length).toBeGreaterThan(0);
    expect((await violations())[0].directive).toBe("img-src");
  });

  test("投稿詳細・書籍詳細で CSP 違反が起きない（書影・投稿画像を含む）", async ({ page }) => {
    const violations = await watchCspViolations(page);

    // ID を固定で書かず一覧の1件目から辿る（contrast.spec.ts と同じ方針）
    await page.goto("/reports");
    await page.locator("tbody tr").first().click();
    await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
    let found = await violations();
    expect(found, `投稿詳細:\n${formatViolations(found)}`).toEqual([]);

    await page.getByRole("link", { name: "この本の投稿一覧" }).click();
    await page.waitForURL(/\/books\/\d{13}$/);
    found = await violations();
    expect(found, `書籍詳細:\n${formatViolations(found)}`).toEqual([]);
  });

  test("テーマ切り替えが動く（＝nonce 付きスクリプトが実行されている）", async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto("/");

    // CSP でクライアント JS がブロックされるとこのボタンは無反応になる。
    // 初期状態は保存なし（OS 追従）なので、1回押すと必ず "light" が保存される
    await page.getByRole("button", { name: /表示テーマ/ }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("light");

    const found = await violations();
    expect(found, `CSP 違反:\n${formatViolations(found)}`).toEqual([]);
  });
});
