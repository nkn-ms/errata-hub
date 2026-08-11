import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * 判定の結果。書ける場合は「**どの出版社として・代理記載か**」まで返す。
 * PublisherComment の行にそのまま書ける形にしてあるのは、呼び出し側が出版社を
 * 引き直さずに済むようにするため（引き直すと判定と保存で別の出版社になりうる）。
 */
export type PublisherCommentPermission =
  | { publisherId: string; byAdmin: boolean; error?: undefined }
  | { publisherId?: undefined; byAdmin?: undefined; error: string };

/**
 * 「この人はこの投稿に、出版社として回答できるか」を判定する。
 *
 * 認可の**4つ目の形態**（既存は services/auth.ts の管理者2種と、actions/report.ts の
 * `updateOwnReport` が持つ「その投稿の投稿者」）。ここだけ services/auth.ts に置いていないのは、
 * あちらが管理操作の入口のための2本だと自分で宣言しているため。
 *
 * ⚠️ **`client` に `tx` を渡せる形にしてあるのは、書き込みと同じ塊の中で判定するため。**
 * 画面を出した時点の判定では、開いている間に管理者が権限を剥奪しても書けてしまう
 * （`updateOwnReport` がステータスの確認をトランザクションの中で行っているのと同じ理由）。
 */
export async function checkPublisherCommentPermission(
  profileId: string,
  reportId: string,
  client: Prisma.TransactionClient = prisma
): Promise<PublisherCommentPermission> {
  const report = await client.report.findUnique({
    where: { id: reportId },
    select: { status: true, book: { select: { publisherId: true } } },
  });
  if (!report) return { error: "投稿が見つかりません" };

  // 規約 第8条2項（運営者が連絡した後に限る）。
  // ⚠️ 技術的にも必要: PENDING の間は投稿者が本文を直せるので、ここで回答を許すと
  //    「出版社が読んだ内容が後から書き換わる」＝追記を別テーブルにして避けた問題が再発する
  if (report.status === "PENDING") {
    return { error: "この投稿はまだ出版社へ連絡していないため、回答できません。" };
  }

  // Book.publisherId は nullable。出版社が分からない本には「どの出版社としての発言か」を
  // 埋められないので、誰も回答できない（管理者の代理記載も同じ）
  const { publisherId } = report.book;
  if (publisherId === null) {
    return { error: "この投稿の書籍には出版社が登録されていないため、回答できません。" };
  }

  const profile = await client.profile.findUnique({
    where: { id: profileId },
    select: {
      role: true,
      publisherAccess: { where: { publisherId }, select: { id: true } },
    },
  });
  if (!profile) return { error: "回答する権限がありません。" };

  // 権限を持っているなら、管理者であっても「本人として」書いたことにする。
  // 付与は管理者が個別に判断して行うもの（= schema.prisma の PublisherAccess）なので、
  // 持っている＝その出版社の関係者として認められている、と読むのが素直
  if (profile.publisherAccess.length > 0) return { publisherId, byAdmin: false };

  // 管理者は権限が無くても書ける＝規約 第8条4項の代理記載。
  // メール等で届いた回答を運営者が代わりに記録する運用がこれに当たる
  if (profile.role === "ADMIN") return { publisherId, byAdmin: true };

  return { error: "この投稿に回答する権限がありません。" };
}
