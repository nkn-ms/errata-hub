// ローカル Supabase のシードアカウント（prisma/seed.ts が作る。ローカル専用の捨てアカウント）。
// - ローカル実行時の認証テスト（auth project）は playwright.config.ts がこの READER を自動使用する
// - 書き込みテスト（*.write.spec.ts）は ADMIN / READER の両方を使う
// 前提: `supabase start` ＋ `npm run seed:local` 済みであること。

export const SEED_ADMIN = { email: "admin@local.test", password: "password123" };
export const SEED_READER = { email: "reader@local.test", password: "password123" };
