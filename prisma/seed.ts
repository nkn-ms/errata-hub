// ローカル開発用のシード（冪等＝何度実行しても安全）。
//   npx prisma db seed   （または npm run seed:local）
//
// やること: ローカル Supabase に「管理者ユーザー＋出版社＋本2冊（投稿あり/なし）」を作る。
// 接続情報は `supabase status` から取得するので、事前に `supabase start` が必要。
// ⚠️ 安全装置: 接続先がローカル(127.0.0.1)でなければ必ず中止する（本番事故防止）。
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ADMIN_EMAIL = "admin@local.test";
const ADMIN_PASSWORD = "password123"; // ローカル専用の捨てアカウント

function getLocalSupabase() {
  let raw: string;
  try {
    raw = execSync("supabase status -o json", { encoding: "utf8" });
  } catch {
    throw new Error("`supabase status` に失敗。先に `supabase start` を実行してください。");
  }
  const s = JSON.parse(raw);
  return { apiUrl: s.API_URL as string, serviceRole: s.SERVICE_ROLE_KEY as string, dbUrl: s.DB_URL as string };
}

async function main() {
  const { apiUrl, serviceRole, dbUrl } = getLocalSupabase();

  // 安全装置: ローカル以外には絶対に流さない。
  if (!dbUrl.includes("127.0.0.1") && !dbUrl.includes("localhost")) {
    throw new Error(`安全のため中止: 接続先がローカルDBではありません (${dbUrl})`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  const admin = createClient(apiUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) 管理者ユーザー（既にいれば再利用）
  let userId: string;
  const created = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "ローカル管理者" },
  });
  if (created.error) {
    const { data } = await admin.auth.admin.listUsers();
    const found = data.users.find((u) => u.email === ADMIN_EMAIL);
    if (!found) throw created.error;
    userId = found.id;
  } else {
    userId = created.data.user!.id;
  }

  // 2) Profile（ADMIN）
  await prisma.profile.upsert({
    where: { id: userId },
    update: { role: "ADMIN", email: ADMIN_EMAIL, displayName: "ローカル管理者" },
    create: { id: userId, email: ADMIN_EMAIL, displayName: "ローカル管理者", role: "ADMIN" },
  });

  // 3) 出版社
  const publisher =
    (await prisma.publisher.findFirst({ where: { name: "オーム社" } })) ??
    (await prisma.publisher.create({ data: { name: "オーム社" } }));

  // 4) 本A（投稿あり＝削除ガード検証用）
  const bookA = await prisma.book.upsert({
    where: { isbn: "9784873116860" },
    update: {},
    create: { title: "Web API:The Good Parts", author: "水野,貴明,1973-", isbn: "9784873116860", publisherId: publisher.id },
  });
  if ((await prisma.report.count({ where: { bookId: bookA.id } })) === 0) {
    await prisma.report.create({
      data: { userId, bookId: bookA.id, title: "サンプル投稿", type: "ERRATA", medium: "PAPER", page: 12, wrong: "誤りの例", correct: "正しい例" },
    });
  }

  // 5) 本B（投稿なし＝削除/編集検証用）
  await prisma.book.upsert({
    where: { isbn: "9784274224478" },
    update: {},
    create: { title: "マスタリングTCP/IP 入門編", author: "井上,直也,1974-", isbn: "9784274224478", publisherId: publisher.id },
  });

  console.log("✓ seed 完了");
  console.log(`  管理者ログイン: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("  出版社: オーム社 / 本: Web API(投稿1) ・ マスタリングTCP/IP(投稿0)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
