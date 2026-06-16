import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { requireAdmin } from "@/services/auth";

const PatchSchema = z.object({
  status: z.enum(["PENDING", "FORWARDED", "IN_REVIEW", "REPLIED", "WILL_FIX", "FIXED", "NO_ACTION", "DISMISSED"]).optional(),
  publisherComment: z.string().nullable().optional(),
  fixedEdition: z.number().int().positive().nullable().optional(),
  fixedPrinting: z.number().int().positive().nullable().optional(),
});

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, error } = await requireAdmin();
    if (error) return error;

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!feedback) {
      return NextResponse.json({ error: "フィードバックが見つかりません" }, { status: 404 });
    }

    // TODO(画像投稿機能の実装後): feedback.images の Supabase Storage 上のファイルも削除する。
    // 現状アップロード未実装のためファイルは存在しない。DB の FeedbackImage 行は
    // schema の onDelete: Cascade により feedback 削除時に自動で消える。
    await prisma.feedback.delete({ where: { id } });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "DELETE_FEEDBACK",
      targetType: "Feedback",
      targetId: id,
      before: feedback as Record<string, unknown>,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力内容が不正です", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const before = await prisma.feedback.findUnique({ where: { id } });
    const feedback = await prisma.feedback.update({
      where: { id },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE_FEEDBACK",
      targetType: "Feedback",
      targetId: id,
      before: { status: before?.status, publisherComment: before?.publisherComment },
      after: { status: feedback.status, publisherComment: feedback.publisherComment },
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
