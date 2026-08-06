import { prisma } from "@/lib/prisma";
import type { AuditAction, TargetType } from "@/constants/audit";
import type { Prisma } from "@/generated/prisma/client";

type AuditParams = {
  userId?: string;
  userEmail?: string;
  // 文字列そのままではなく AUDIT_ACTION の値に限る。新しい操作を足したとき、
  // 表示ラベル（AUDIT_ACTION_LABELS）の追加漏れを tsc に見つけさせるための縛り。
  action: AuditAction;
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
 *    「ログだから安全」ではない。名前はログでも中身は**説明義務のある業務記録**なので、
 *    観測目的の best-effort なログ（console 等）と同じ扱いにしない。
 *
 * ⚠️ **管理操作の書き込みは原則すべて塊に入れる**（`actions/` の book / publisher / report / user）。
 *    目的は「操作は成立したのに記録だけが無い」状態を作らないこと。
 *    ⇒ 呼び出し側で `prisma.$transaction` を張り、`tx` をこの関数に渡す。手本は
 *      actions/report.ts の deleteReport。
 *
 * ⚠️ 例外は**退会の2か所**（actions/auth.ts の withdraw / actions/user.ts の withdrawUserAsAdmin）。
 *    Supabase の admin API（外部）をまたぐのでトランザクションに入れられず、
 *    「退会は成立させ、記録の失敗は console.error に留める」方向に倒してある（各所のコメント参照）。
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
