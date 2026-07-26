import { test, expect } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// 画像アップロードの Route Handler に対する同一オリジン検査（CSRF 対策）の回帰テスト。
//
// なぜ e2e で固定するか: Server Actions には Next.js が自動で CSRF 対策を入れるが、
// Route Handler はその保護の外にある（出典: node_modules/next/dist/docs/01-app/02-guides/data-security.md）。
// 「Next がやってくれている」と勘違いして検査を消されると、静かに穴が開く。
//
// ⚠️ ブラウザの fetch では Origin を偽装できない（禁止ヘッダ名）ので、
// ブラウザではなく APIRequestContext から投げる。page.request はブラウザコンテキストと
// cookie を共有するので、ログイン済みの状態のまま Origin だけ差し替えられる。
test.describe("画像アップロードの同一オリジン検査", () => {
  const path = "/api/reports/00000000-0000-0000-0000-000000000000/images";

  test("別オリジンからの POST は 403 で弾く", async ({ page }) => {
    await login(page, READER);

    const res = await page.request.post(path, {
      headers: { origin: "https://evil.example" },
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0]) } },
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: "不正なリクエストです" });
  });

  test("Origin が無い POST も弾く（ブラウザは POST に必ず付ける）", async ({ page }) => {
    await login(page, READER);

    const res = await page.request.post(path, {
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0]) } },
    });

    expect(res.status()).toBe(403);
  });

  test("同一オリジンなら検査を通過する（403 にならない）", async ({ page }) => {
    await login(page, READER);
    const origin = new URL(page.url()).origin;

    const res = await page.request.post(path, {
      headers: { origin },
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0]) } },
    });

    // 存在しない投稿 ID なので 404 になる = オリジン検査と認証を通り抜けた証拠。
    // 403 で落ちていないことが確認したい点（正規のフォームを巻き込んでいない）
    expect(res.status()).toBe(404);
  });
});
