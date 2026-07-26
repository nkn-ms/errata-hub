import { test, expect } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// セッション Cookie が JavaScript から読めないこと（HttpOnly）の検査。
//
// なぜ検査するか: これが外れると **XSS が1回成立した時点でセッションを持ち出され、
// アカウント乗っ取りまで届く**。CSP（予防）が破られた後の最後の壁なので、
// 静かに外れることを防ぎたい。設定は src/lib/supabase/cookie-options.ts の1か所。
//
// ⚠️ `@supabase/ssr` の既定は httpOnly: false で、Supabase 公式は「HttpOnly は不要」という立場
// （ブラウザ側クライアントがトークンを読む構成を前提にしているため）。このアプリはブラウザから
// Supabase を触らないので塞げている＝**ベンダーの既定から意図的に外れている**。
// ライブラリ更新でここが黙って戻る可能性があるため、テストで固定する。

test("セッション Cookie は HttpOnly で、JS から読めない", async ({ page, context }) => {
  await login(page, READER);

  // ① JS から見えないこと
  const jsVisible = await page.evaluate(() => document.cookie);
  expect(jsVisible, `document.cookie: ${jsVisible}`).not.toContain("auth-token");

  // ② 「Cookie がそもそも無い」で緑にならないよう、存在も確かめる
  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(authCookies.length, "sb-* の認証 Cookie が見つからない（ログイン自体が失敗している）").toBeGreaterThan(0);

  // ③ 全部 HttpOnly であること
  for (const cookie of authCookies) {
    expect(cookie.httpOnly, `${cookie.name} が HttpOnly でない`).toBe(true);
  }

  // ④ HttpOnly でもセッションが維持されること（要ログインのページに入れる）
  await page.goto("/submit");
  await expect(page).toHaveURL(/\/submit$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
