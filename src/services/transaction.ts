import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * トランザクション（1つの塊）を開き、塊の中で使うクライアント（`tx`）を渡して `run` を実行する。
 * `run` が例外を投げたら塊ごと巻き戻る。⚠️ 値を返して抜けたときはコミットされる
 * （それまでに書いたものは残る）＝書く前に確かめ、確かめて止めるときは値を返して抜ける。
 *
 * ⭐ **塊を開くのは usecases（手順を持つ側）。** 塊の中で呼ぶ features/<name>/db/ の関数と
 *    services/audit.ts の createAuditLog には、受け取った `tx` を最後の引数で渡す。
 *    こうすると、複数のフィーチャーにまたがる塊（例: usecases/update-book.ts ＝出版社の用意と書籍の更新）も、
 *    フィーチャー同士を import せずに組める。
 *
 * services に置くのは、塊を開くためだけに usecases が prisma を import しなくて済むようにするため。
 *
 * ⚠️ 塊の中では `tx` だけを使う。グローバルの `prisma` で書くと別の接続で実行され、
 *    塊の外に出る（巻き戻らない）。
 */
export function runInTransaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(run);
}
