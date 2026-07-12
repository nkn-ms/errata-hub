import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_BUCKET,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
} from "@/constants/report-images";

// 投稿への画像添付。multipart/form-data で1リクエスト1ファイル
// （Vercel のボディ上限 4.5MB に収めるため、複数枚はクライアントが直列に送る）。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!report) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (report.userId !== user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    if (report._count.images >= REPORT_IMAGE_MAX_COUNT) {
      return NextResponse.json(
        { error: `画像は${REPORT_IMAGE_MAX_COUNT}枚までです` },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
    }
    const ext = REPORT_IMAGE_ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "JPEG / PNG / WebP のみアップロードできます" },
        { status: 400 }
      );
    }
    if (file.size > REPORT_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "画像は1枚4MB以下にしてください" }, { status: 400 });
    }

    // Storage への書き込みは secret キー（サーバー専用）で行う。Storage 側のポリシーは
    // 一切開けず、認可は上の本人チェックで完結させる（認可はサーバー層に集約する方針）。
    // ファイル名はサーバーが採番（ユーザー入力のファイル名をパスに使わない）。
    const admin = createAdminClient();
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(REPORT_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from(REPORT_IMAGE_BUCKET).getPublicUrl(path);
    const image = await prisma.reportImage.create({
      data: { reportId: id, imageUrl: publicUrl },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
