import { defineConfig, devices } from "@playwright/test";

// e2e（読み取り専用スモーク）の設定。
// 本番 Supabase に接続するため、テストは「表示・遷移・バリデーション」に限定し、
// 書き込み（会員登録・投稿）は行わない方針（本番DBを汚さない）。
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// 外部URL（Vercel等）を指定したときは自前でサーバーを起動しない。
const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // dev サーバーをローカルで起動（既に起動済みなら再利用）。
  // dev は初回アクセスでルートをコンパイルするため timeout は長めに取る。
  webServer: isLocal
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
