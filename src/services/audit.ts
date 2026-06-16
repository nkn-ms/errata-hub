import { prisma } from "@/lib/prisma";
import type { TargetType } from "@/constants/audit";

type AuditParams = {
  userId?: string;
  userEmail?: string;
  action: string;
  targetType: TargetType;
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export async function createAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
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
