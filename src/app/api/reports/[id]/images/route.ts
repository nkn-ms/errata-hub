import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_BUCKET,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_MB,
} from "@/constants/report-images";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/utils/same-origin";

// 競合で枚数上限に達していたことを表す番兵。トランザクションを確実にロールバックさせるために投げる。
class ImageLimitReached extends Error {}

// 投稿への画像添付。multipart/form-data で1リクエスト1ファイル
// （Vercel のボディ上限 4.5MB に収めるため、複数枚はクライアントが直列に送る）。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Server Actions と違い Route Handler には Next.js の CSRF 対策が効かないので自前で検査する
    // （詳細は utils/same-origin.ts）。認証より先に弾く＝ DB にも Supabase にも触らせない
    if (!isSameOriginRequest(request.headers)) {
      return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 画像は Storage の容量課金に直結するので、本文を読む（＝転送を受け切る）前に判定する
    const limit = await checkRateLimit(
      rateLimitKey("reportImageUpload", user.id),
      RATE_LIMITS.reportImageUpload
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: rateLimitMessage(limit.retryAfterSec) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
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
    // 早期チェック（速い失敗用）。厳密な上限判定は作成直前のトランザクションで行う（下の TOCTOU 対策）。
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
      return NextResponse.json({ error: `画像は1枚${REPORT_IMAGE_MAX_MB}MB以下にしてください` }, { status: 400 });
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

    try {
      // 枚数上限の最終ガード。上の早期チェックは速い失敗のためのもので、並列送信では
      // チェックと作成の間（＝時間のかかる Storage アップロードの間）に別リクエストが割り込める（TOCTOU）。
      // 親 Report 行を FOR UPDATE でロックして同一投稿への並列アップロードを直列化し、
      // 確定した枚数で判定してから作成する。別投稿どうしは id が違うので競合しない。
      const image = await prisma.$transaction(async (tx) => {
        // 生 SQL のテーブル名は @@map なしの既定（モデル名）に一致する
        await tx.$queryRaw`SELECT 1 FROM "Report" WHERE id = ${id} FOR UPDATE`;
        const count = await tx.reportImage.count({ where: { reportId: id } });
        if (count >= REPORT_IMAGE_MAX_COUNT) {
          throw new ImageLimitReached();
        }
        return tx.reportImage.create({ data: { reportId: id, imageUrl: publicUrl } });
      });
      return NextResponse.json(image, { status: 201 });
    } catch (e) {
      if (e instanceof ImageLimitReached) {
        // 競合に負けて上限に達していた: 先にアップロード済みのファイルは DB 行を持たない孤児に
        // なるため、掃除してから 400 を返す。
        await admin.storage.from(REPORT_IMAGE_BUCKET).remove([path]);
        return NextResponse.json(
          { error: `画像は${REPORT_IMAGE_MAX_COUNT}枚までです` },
          { status: 400 }
        );
      }
      throw e; // 想定外は下の catch で 500
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
