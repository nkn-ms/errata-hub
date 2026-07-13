// 退会テスト専用の「使い捨てアカウント」を作るヘルパ。
//
// なぜ UI の会員登録を使わないか:
//   `Profile` 行は `/auth/callback`（メール確認 or OAuth の戻り）でしか作られない。
//   ローカルは supabase/config.toml が enable_confirmations = false なので確認メールが
//   飛ばず callback を通らない ＝ UI 登録だけでは Profile の無いユーザーができてしまう。
//   そこで prisma/seed.ts と同じ方式（管理APIでユーザー作成＋Profile を直接作成）を使う。
//
// ⚠️ 退会はアカウントを消す不可逆な操作なので、シードアカウント（admin/reader）は使わない。
// 使い捨てアカウントをテストごとに作り、退会させて終わる。
//
// Profile 行の作り方について:
//   - Prisma は使えない（Prisma 7 の生成クライアントは ESM 専用で、Playwright のテスト変換=CJS
//     から import できない）
//   - PostgREST（supabase-js の .from()）も使えない。service_role でも `permission denied for
//     schema public` になる ＝ RLS 全拒否ロック（design.md §7）が効いている正しい状態
//   → よって DB へ直接つなぐ（pg）。接続先はローカル固定で、下の安全装置で本番を弾く。
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import dotenv from "dotenv";

export type ThrowawayAccount = {
  id: string;
  email: string;
  password: string;
  displayName: string;
};

// ローカル Supabase の接続情報は .env.local から読む（`npm run dev` が使うのと同じ値）。
function getLocalSupabase() {
  dotenv.config({ path: ".env.local", quiet: true });
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SECRET_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!apiUrl || !serviceRole || !dbUrl) {
    throw new Error(".env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / DATABASE_URL が必要です");
  }
  return { apiUrl, serviceRole, dbUrl };
}

export async function createThrowawayAccount(): Promise<ThrowawayAccount> {
  const { apiUrl, serviceRole, dbUrl } = getLocalSupabase();

  // 安全装置: ローカル以外には絶対に作らない（seed.ts と同じ思想）。
  // 万一 .env.local が本番を指していても、ここで止まる。
  const isLocal = (url: string) => url.includes("127.0.0.1") || url.includes("localhost");
  if (!isLocal(apiUrl) || !isLocal(dbUrl)) {
    throw new Error(`安全のため中止: 接続先がローカルではありません (api=${apiUrl})`);
  }

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const account = {
    email: `e2e-throwaway-${unique}@local.test`,
    password: "password123",
    displayName: `E2E使い捨て${unique}`,
  };

  const admin = createClient(apiUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true, // 確認済みで作る（ローカルには確認メールの受け口が無いため）
    user_metadata: { display_name: account.displayName },
  });
  if (created.error) throw created.error;
  const id = created.data.user!.id;

  // updatedAt は Prisma の @updatedAt（アプリ側で入れる列）なので、DB 直挿しでは明示が要る
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    await db.query(
      'INSERT INTO "Profile" (id, email, "displayName", role, "updatedAt") VALUES ($1, $2, $3, $4, now())',
      [id, account.email, account.displayName, "USER"]
    );
  } finally {
    await db.end();
  }

  return { id, ...account };
}
