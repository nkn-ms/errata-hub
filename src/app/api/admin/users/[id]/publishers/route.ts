import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog } from "@/services/audit";
import { requireAdmin } from "@/services/auth";

const BodySchema = z.object({
  publisherId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params;
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const access = await prisma.publisherAccess.create({
    data: { profileId, publisherId: parsed.data.publisherId },
    include: { publisher: true },
  });

  await createAuditLog({
    userId: user?.id,
    userEmail: user?.email,
    action: "GRANT_PUBLISHER_ACCESS",
    targetType: "PublisherAccess",
    targetId: profileId,
    after: { publisherId: parsed.data.publisherId, publisherName: access.publisher.name },
  });

  return Response.json(access, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params;
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { publisherId } = await request.json();

  const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });

  await prisma.publisherAccess.deleteMany({
    where: { profileId, publisherId },
  });

  await createAuditLog({
    userId: user?.id,
    userEmail: user?.email,
    action: "REVOKE_PUBLISHER_ACCESS",
    targetType: "PublisherAccess",
    targetId: profileId,
    before: { publisherId, publisherName: publisher?.name },
  });

  return new Response(null, { status: 204 });
}
