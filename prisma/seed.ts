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

// 一般ユーザー（管理者の投稿への賛同など「他人の投稿」が要るテストで使う）
const READER_EMAIL = "reader@local.test";
const READER_PASSWORD = "password123";

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

  // 確認済みユーザーを作成（既にいれば再利用）して id を返す
  async function ensureUser(email: string, password: string, displayName: string): Promise<string> {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (created.error) {
      const { data } = await admin.auth.admin.listUsers();
      const found = data.users.find((u) => u.email === email);
      if (!found) throw created.error;
      return found.id;
    }
    return created.data.user!.id;
  }

  // 1) 管理者ユーザー＋一般ユーザー
  const userId = await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD, "ローカル管理者");
  const readerId = await ensureUser(READER_EMAIL, READER_PASSWORD, "ローカル読者");

  // 2) Profile（ADMIN / USER）
  await prisma.profile.upsert({
    where: { id: userId },
    update: { role: "ADMIN", email: ADMIN_EMAIL, displayName: "ローカル管理者" },
    create: { id: userId, email: ADMIN_EMAIL, displayName: "ローカル管理者", role: "ADMIN" },
  });
  await prisma.profile.upsert({
    where: { id: readerId },
    update: { role: "USER", email: READER_EMAIL, displayName: "ローカル読者" },
    create: { id: readerId, email: READER_EMAIL, displayName: "ローカル読者", role: "USER" },
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
      data: { userId, bookId: bookA.id, title: "サンプル投稿", type: "ERRATA", medium: "PAPER", edition: 1, page: 12, wrong: "誤りの例", correct: "正しい例" },
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
  console.log(`  一般ユーザー: ${READER_EMAIL} / ${READER_PASSWORD}`);
  console.log("  出版社: オーム社 / 本: Web API(投稿1) ・ マスタリングTCP/IP(投稿0)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
