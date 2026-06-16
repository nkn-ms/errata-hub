import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
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

    const report = await prisma.report.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!report) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    // TODO(画像投稿機能の実装後): report.images の Supabase Storage 上のファイルも削除する。
    // 現状アップロード未実装のためファイルは存在しない。DB の ReportImage 行は
    // schema の onDelete: Cascade により report 削除時に自動で消える。
    await prisma.report.delete({ where: { id } });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "DELETE_REPORT",
      targetType: TARGET_TYPE.REPORT,
      targetId: id,
      before: report as Record<string, unknown>,
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

    const before = await prisma.report.findUnique({ where: { id } });
    const report = await prisma.report.update({
      where: { id },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE_REPORT",
      targetType: TARGET_TYPE.REPORT,
      targetId: id,
      before: { status: before?.status, publisherComment: before?.publisherComment },
      after: { status: report.status, publisherComment: report.publisherComment },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
