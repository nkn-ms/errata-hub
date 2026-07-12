import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdmin } from "@/services/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_IMAGE_BUCKET } from "@/constants/report-images";
import { storagePathFromPublicUrl } from "@/utils/report-images";

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

    // DB の ReportImage 行は onDelete: Cascade で report と一緒に消えるが、
    // Storage 上のファイル実体は別管理なのでここで削除する。
    // DB 削除を先に行う（公開ページから参照が消えるのが先。ファイル削除が失敗しても
    // 投稿の削除自体は成立させ、孤児ファイルはログで追えるようにする）。
    await prisma.report.delete({ where: { id } });

    const imagePaths = report.images
      .map((image) => storagePathFromPublicUrl(image.imageUrl))
      .filter((path): path is string => path !== null);
    if (imagePaths.length > 0) {
      const admin = createAdminClient();
      const { error: removeError } = await admin.storage
        .from(REPORT_IMAGE_BUCKET)
        .remove(imagePaths);
      if (removeError) {
        // 投稿削除は完了しているため 500 にはしない。孤児ファイルの手掛かりとして記録のみ。
        console.error("画像ファイルの削除に失敗:", imagePaths, removeError);
      }
    }

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
      // PatchSchema が受ける4項目すべてを記録する（fixedEdition/fixedPrinting は FIXED 運用の要）
      before: {
        status: before?.status,
        publisherComment: before?.publisherComment,
        fixedEdition: before?.fixedEdition,
        fixedPrinting: before?.fixedPrinting,
      },
      after: {
        status: report.status,
        publisherComment: report.publisherComment,
        fixedEdition: report.fixedEdition,
        fixedPrinting: report.fixedPrinting,
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
