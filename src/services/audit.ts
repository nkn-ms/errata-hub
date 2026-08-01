import { prisma } from "@/lib/prisma";
import type { TargetType } from "@/constants/audit";
import type { Prisma } from "@/generated/prisma/client";

type AuditParams = {
  userId?: string;
  userEmail?: string;
  action: string;
  targetType: TargetType;
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * 監査ログを1件書く。
 *
 * `client` にトランザクションのクライアントを渡すと、**その塊の一部として**書かれる
 * （＝呼び出し元の操作が巻き戻れば、この記録も一緒に巻き戻る）。
 *
 * ⚠️ トランザクションの中からグローバルの `prisma` を使うと**別の接続で実行され、
 *    塊の外に出てしまう**（ロールバックされない）。中で書くときは必ず `tx` を渡すこと。
 *
 * ⚠️ この関数は DB への INSERT なので、普通に失敗しうる（接続の枯渇・タイムアウト等）。
 *    「ログだから安全」ではない。証跡が要る操作では、操作本体と同じ塊に入れて
 *    「記録が残らないなら操作も成立させない」形にする（例: actions/report.ts の削除）。
 */
export async function createAuditLog(
  params: AuditParams,
  client: Prisma.TransactionClient = prisma
) {
  await client.auditLog.create({
    data: {
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
      after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
    },
  });
}
