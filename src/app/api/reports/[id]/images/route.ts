import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_BUCKET,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_MB,
} from "@/features/report/constants/report-images";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/services/rate-limit";
import { isSameOriginRequest } from "@/utils/same-origin";
import {
  addendumBelongsToReport,
  countImagesInPool,
  createReportImageWithinLimit,
  findReportForImageUpload,
  IMAGE_POOL_CLOSED_MESSAGE,
  imagePool,
} from "@/features/report/db/report-images";
import { hasEmbeddedMetadata } from "@/features/report/utils/image-metadata";

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

    const report = await findReportForImageUpload(id);
    if (report === null) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (report.userId !== user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    // 追記に添えて足された画像は、その追記に紐づける（未指定＝投稿本体の画像）。
    // 他人の投稿の追記 ID を渡されても付かないよう、この投稿の追記であることを確かめる。
    const addendumId = new URL(request.url).searchParams.get("addendumId");
    if (addendumId !== null && !(await addendumBelongsToReport(addendumId, id))) {
      return NextResponse.json({ error: "追記が見つかりません" }, { status: 404 });
    }

    // 枠は本体と追記で別（理由は constants/report-images.ts）。どちらで数えるかは addendumId で決まる
    const pool = imagePool(addendumId);

    // 本体の枠は連絡前だけ開いている（理由は imagePool）。本文を読む前・Storage に上げる前に弾く
    if (!pool.isOpen(report.status)) {
      return NextResponse.json({ error: IMAGE_POOL_CLOSED_MESSAGE }, { status: 409 });
    }

    // 早期チェック（速い失敗用）。厳密な上限判定は作成直前のトランザクションで行う
    // （TOCTOU 対策の理由は features/report/db/report-images.ts）。
    if ((await countImagesInPool(id, addendumId)) >= pool.limit) {
      return NextResponse.json({ error: pool.message }, { status: 400 });
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
    // 撮影情報（撮影場所の緯度・経度を含みうる）が残った画像は受け付けない。保存先は公開バケットで、
    // 置いた時点で誰でも読める。落とすのはブラウザの仕事（utils/image-compress.ts）で、ここに来るのは
    // その処理が失敗したときかフォームを通さずに送られたとき。
    // サーバーで描き直して落とさないのは、関数内の画像処理が Active CPU を直接食うため（utils/image-compress.ts の冒頭）
    if (hasEmbeddedMetadata(new Uint8Array(await file.arrayBuffer()))) {
      return NextResponse.json(
        { error: "撮影場所などの情報（EXIF）を含む画像のため、アップロードできませんでした。スクリーンショットを撮り直すなど、別の画像でお試しください。" },
        { status: 400 }
      );
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

    // 行の作成に失敗した＝先にアップロード済みのファイルは DB 行を持たない孤児になるため、
    // **失敗の理由に関わらず**掃除する。トランザクションなので「行はできたのに失敗」は
    // 起こり得ず、ここに来た時点で残ったファイルが孤児であることは確定している。
    // ⚠️ 掃除自体が失敗したときはもう手掛かりを残す先が無い（DB 行が無いので監査ログにも
    //    載らない）ので、パスを添えて記録する。
    const cleanUpUploadedFile = async () => {
      const { error: cleanupError } = await admin.storage.from(REPORT_IMAGE_BUCKET).remove([path]);
      if (cleanupError) {
        console.error("アップロード失敗後の画像ファイル削除に失敗:", path, cleanupError);
      }
    };

    let created;
    try {
      created = await createReportImageWithinLimit({ reportId: id, addendumId, imageUrl: publicUrl });
    } catch (e) {
      await cleanUpUploadedFile();
      throw e; // 想定外は下の catch で 500
    }
    if (!created.ok) {
      // 競合に負けた（上限に達していた／アップロードの間に連絡済みになり本体の枠が閉じた）
      await cleanUpUploadedFile();
      return created.reason === "closed"
        ? NextResponse.json({ error: IMAGE_POOL_CLOSED_MESSAGE }, { status: 409 })
        : NextResponse.json({ error: pool.message }, { status: 400 });
    }

    return NextResponse.json(created.image, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
