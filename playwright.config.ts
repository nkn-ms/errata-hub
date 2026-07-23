import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { SEED_READER } from "./e2e/seed-accounts";

// ログイン済みテスト用の認証情報などを .env.e2e から読む（存在すれば）。
// このファイルは gitignore 済み（テンプレは .env.e2e.example）。
dotenv.config({ path: ".env.e2e", quiet: true });

// e2e の設定。
// 既定（chromium）は読み取り専用スモーク（表示・遷移・バリデーション）に限定し、
// 書き込み（登録・投稿）は行わない＝安全側の既定。
// BASE_URL の既定 http://localhost:3000 は「ローカル dev＝ローカル Supabase（.env.local）」を指す。
// E2E_BASE_URL を本番/Preview に向けるとそのホスト Supabase に接続するため、読み取り専用を維持して事故を防ぐ。
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// 外部URL（Vercel等）を指定したときは自前でサーバーを起動しない。
const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");

// 認証テスト（auth project）のアカウントの決め方:
// - ローカル（既定）: 常にシードアカウント（prisma/seed.ts の reader@local.test）を使う。
//   .env.e2e にホスト側（本番/Preview）のアカウントが入っていても、ローカル Supabase には
//   存在せずログインが必ず失敗するため、ローカルでは .env.e2e を参照しない＝上書きする。
//   前提は書き込みテストと同じ（supabase start ＋ npm run seed:local）。
// - 外部URL（E2E_BASE_URL 指定時）: .env.e2e の E2E_TEST_EMAIL / E2E_TEST_PASSWORD を使う。
if (isLocal) {
  process.env.E2E_TEST_EMAIL = SEED_READER.email;
  process.env.E2E_TEST_PASSWORD = SEED_READER.password;
}

// 確認済みテストアカウントの認証情報がある場合のみ、ログイン済みテストを有効化する
// （ローカルは上でシード垢を注入するので常に有効）。無いときは auth-setup / authenticated
// を project に含めないので、既定スイートは緑のまま。
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

// 書き込み系（投稿・賛同）の e2e はローカル dev＋ローカル Supabase 限定。
// シードアカウント（prisma/seed.ts）でテスト内ログインするため .env.e2e は不要。
// E2E_BASE_URL を本番/Preview に向けたときは project ごと外れるので、誤って
// ホスト側 DB に書き込むことはない（安全側の既定を維持）。
const writeProjects = isLocal
  ? [
      {
        name: "write-local",
        testMatch: /.*\.write\.spec\.ts/,
        // 同一データ（シード投稿のステータス・賛同数など）を触るため並列にしない。
        // fullyParallel: false は「1ファイル内を直列化」するだけでファイル間は並列に走るので、
        // 共有データを触るプロジェクトでは workers: 1 まで要る
        // （出典: https://playwright.dev/docs/api/class-testproject#test-project-workers ）。
        // 実測: admin.write と report-status.write は同じシード投稿のステータスを書き換えるため、
        // これが無いと 2 worker に分かれて互いの後片付けを踏む。
        fullyParallel: false,
        workers: 1,
        use: { ...devices["Desktop Chrome"] },
      },
    ]
  : [];

const authProjects = hasCreds
  ? [
      {
        name: "auth-setup",
        testMatch: /auth\.setup\.ts/,
      },
      {
        name: "authenticated",
        testMatch: /.*\.auth\.spec\.ts/,
        use: {
          ...devices["Desktop Chrome"],
          storageState: "e2e/.auth/user.json",
        },
        dependencies: ["auth-setup"],
      },
    ]
  : [];

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
      // 認証セットアップ／認証テスト／書き込みテストは別 project で扱うので、ここでは除外。
      testIgnore: [/auth\.setup\.ts/, /.*\.auth\.spec\.ts/, /.*\.write\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    ...authProjects,
    ...writeProjects,
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
