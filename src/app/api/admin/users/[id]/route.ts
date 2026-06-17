import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdmin } from "@/services/auth";

const PatchSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = PatchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const before = await prisma.profile.findUnique({ where: { id } });
  const profile = await prisma.profile.update({
    where: { id },
    data: { role: parsed.data.role },
  });

  await createAuditLog({
    userId: user?.id,
    userEmail: user?.email,
    action: "UPDATE_USER_ROLE",
    targetType: TARGET_TYPE.PROFILE,
    targetId: id,
    before: { role: before?.role },
    after: { role: profile.role },
  });

  return Response.json(profile);
}
