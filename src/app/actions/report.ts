"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { toCanonicalIsbn } from "@/utils/isbn";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";
import { sanitizeExternalUrl } from "@/utils/external-url";
import { REPORT_IMAGE_BUCKET } from "@/constants/report-images";
import { REPORT_LIMITS } from "@/constants/report-limits";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/constants/report-messages";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";
import { storagePathFromPublicUrl } from "@/utils/report-images";
import { routes } from "@/constants/routes";
import { formatJstDateTime } from "@/utils/format";
import { ReportType, Medium, Prisma } from "@/generated/prisma/client";

// ISBN を本の同一性の基準にする方針のため isbn は必須。
// 形式の正規化・検証は toCanonicalIsbn（ISBN-13 へ統一）で行う。
const BookSchema = z.object({
  googleBooksId: z.string().optional(),
  title: z.string().min(1, "書籍名は必須です"),
  author: z.string().optional(),
  publisher: z.string().optional(),
  isbn: z.string().min(1, "ISBNは必須です"),
  coverImageUrl: z.string().optional(),
});

// 文字数上限は REPORT_LIMITS（フォームの maxLength と同じ値）で一元管理する。
// フォームで打ち切られる想定だが、アクション直叩き・貼り付け経路もあるのでサーバーでも弾く。
//
// 前後の空白は落とす。判断の基準は2つで、**どちらも No ならトリムしてよい**:
//   ① その空白は画面に現れるか → No（HTML は前後の空白を描画しない）
//   ② その空白は内容の一部として指摘の対象になりうるか → No
//      （誤/正 は紙面からの書き写しで、紙面の「前後の空白」はそもそも観測できない）
// 残すと「見た目は同じなのに比較・検索・重複判定だけが食い違う」という説明できない挙動になる。
// ⚠️ trim は**文字列全体の前後**であって各行の前後ではない。複数行のコード例を貼っても
//    中間行の行末空白は残るので、引用の内部構造は壊れない。
// ⚠️ 全角/半角の違いはトリムでは変わらない（"ＡＰＩ".trim() === "ＡＰＩ"）。
//    そちらは意味のある差として保つ＝正規化はしない。
const limited = (max: number, label: string) =>
  z.string().trim().max(max, `${label}は${max}文字以内で入力してください`);

// 新規投稿と編集で共有する（分けると上限や必須条件が片方だけ変わる）。
// クライアント側の同じ役目は components/report-fields.tsx
const reportBodyShape = {
  edition: z.number().int().positive().nullable().optional(),
  printing: z.number().int().positive().nullable().optional(),
  title: limited(REPORT_LIMITS.title, "タイトル").min(1, "タイトルは必須です"),
  type: z.enum(["ERRATA", "SUGGESTION", "OTHER"]),
  medium: z.enum(["PAPER", "EBOOK", "OTHER"]),
  page: z.number().int().positive().nullable().optional(),
  line: z.number().int().positive().nullable().optional(),
  hasMultiplePages: z.boolean().optional(),
  locationNote: limited(REPORT_LIMITS.locationNote, "位置備考").nullable().optional(),
  ebookLocation: limited(REPORT_LIMITS.ebookLocation, "位置").nullable().optional(),
  wrong: limited(REPORT_LIMITS.wrong, "誤（該当箇所）").nullable().optional(),
  correct: limited(REPORT_LIMITS.correct, "正（正しい内容）").nullable().optional(),
  content: limited(REPORT_LIMITS.content, "内容・提案").nullable().optional(),
  note: limited(REPORT_LIMITS.note, "備考").nullable().optional(),
} as const;

const ReportBodyBase = z.object(reportBodyShape);

// 種別・媒体ごとの条件付き必須。UI と同じ条件をサーバーでも強制する（アクション直叩き対策）。
function refineReportBody(data: z.infer<typeof ReportBodyBase>, ctx: z.RefinementCtx) {
  if (data.type === "ERRATA") {
    if (!data.wrong?.trim()) {
      ctx.addIssue({ code: "custom", path: ["wrong"], message: "誤（該当箇所）は必須です" });
    }
    if (!data.correct?.trim()) {
      ctx.addIssue({ code: "custom", path: ["correct"], message: "正（正しい内容）は必須です" });
    }
    // 誤と正が同じなら指摘として成立しない。誤をコピーして直し忘れたときに起きる。
    // この時点で値は limited() によりトリム済みなので、前後の空白しか違わないものも同じと見なす
    // （見えない差なので、投稿者にとっては「同じものを送った」のと変わらない）。
    // ⚠️ 一方で**全角/半角の正規化はしない**。「ＡＰＩ → API」は見える差であり、
    //    このサイトで最も価値のある種類の指摘に含まれるため、別物として通す。
    if (data.wrong && data.correct && data.wrong === data.correct) {
      ctx.addIssue({ code: "custom", path: ["correct"], message: IDENTICAL_WRONG_CORRECT_MESSAGE });
    }
  } else if (!data.content?.trim()) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "内容・提案は必須です" });
  }
  if (data.medium === "PAPER" && data.edition == null) {
    ctx.addIssue({ code: "custom", path: ["edition"], message: "版は必須です" });
  }
  if (data.medium === "PAPER" && data.page == null) {
    ctx.addIssue({ code: "custom", path: ["page"], message: "ページ番号は必須です" });
  }
  if (data.medium === "EBOOK" && !data.ebookLocation?.trim()) {
    ctx.addIssue({ code: "custom", path: ["ebookLocation"], message: "位置は必須です" });
  }
  if (data.medium === "OTHER" && !data.locationNote?.trim()) {
    ctx.addIssue({ code: "custom", path: ["locationNote"], message: "位置メモは必須です" });
  }
}

const ReportSchema = z.object({
  book: BookSchema,
  ...reportBodyShape,
  // 投稿者が見つけた出版社の正誤表 URL の申告（任意）。公開せず、管理者が採用の可否を判断する。
  // 投稿の中身ではなく本に関する情報なので、編集（ReportBodySchema）の対象には入れない
  reportedErratumUrl: limited(REPORT_LIMITS.reportedErratumUrl, "正誤表のURL").nullable().optional(),
}).superRefine((data, ctx) => {
  refineReportBody(data, ctx);
  // 正誤表 URL は任意だが、入力するなら http / https の正しい URL であること。
  // ⚠️ https 限定ではない。何を通し何を弾くか、その理由は sanitizeExternalUrl 側に書いてある
  if (data.reportedErratumUrl?.trim() && !sanitizeExternalUrl(data.reportedErratumUrl)) {
    ctx.addIssue({
      code: "custom",
      path: ["reportedErratumUrl"],
      message: "正誤表のURLは http:// または https:// から始まる正しいURLを入力してください",
    });
  }
});

const ReportBodySchema = ReportBodyBase.superRefine(refineReportBody);
export type ReportBodyInput = z.input<typeof ReportBodySchema>;

export type ReportInput = z.input<typeof ReportSchema>;
export type CreateReportResult = { id: string; error?: undefined } | { id?: undefined; error: string };

export async function createReport(input: ReportInput): Promise<CreateReportResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "認証が必要です" };
    }

    // 認証の直後に消費する。ここより後は書籍の upsert 等で DB に書き込みが発生するため、
    // 弾くならその手前で弾く
    const limit = await checkRateLimit(
      rateLimitKey("createReport", user.id),
      RATE_LIMITS.createReport
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    const parsed = ReportSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }
    const { book, edition, printing, title, type, medium, page, line,
            hasMultiplePages, locationNote, ebookLocation, wrong, correct, content, note,
            reportedErratumUrl } = parsed.data;

    // ISBN-13 に正規化（ISBN-10 は変換、不正な ISBN は弾く）
    const canonicalIsbn = toCanonicalIsbn(book.isbn);
    if (!canonicalIsbn) {
      return { error: "ISBNが正しくありません" };
    }

    // 出版社を名前で upsert（name は @unique — 同時投稿でも重複作成されない）
    let publisherId: string | null = null;
    if (book.publisher) {
      const publisher = await prisma.publisher.upsert({
        where: { name: book.publisher },
        update: {},
        create: { name: book.publisher },
      });
      publisherId = publisher.id;
    }

    // ISBN を同一性の基準として upsert で名寄せ（@unique 制約により競合にも安全）
    const bookRecord = await prisma.book.upsert({
      where: { isbn: canonicalIsbn },
      update: {},
      create: {
        title: book.title,
        author: book.author || null,
        isbn: canonicalIsbn,
        // 許可ホスト（OpenBD / Google Books）以外は null に落とす。書影は装飾情報なので、
        // 提供元のホスト変更等があっても投稿自体は失敗させない（エラーにしない）。
        coverImageUrl: sanitizeCoverImageUrl(book.coverImageUrl),
        publisherId,
      },
    });

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        bookId: bookRecord.id,
        title,
        edition: edition ?? null,
        printing: printing ?? null,
        type: type as ReportType,
        medium: medium as Medium,
        page: page ?? null,
        line: line ?? null,
        hasMultiplePages: hasMultiplePages ?? false,
        locationNote: locationNote ?? null,
        ebookLocation: ebookLocation ?? null,
        wrong: wrong ?? null,
        correct: correct ?? null,
        content: content ?? null,
        note: note ?? null,
        // 申告 URL は公開しないが、保存時にもサニタイズしておく（不正な値を DB に入れない）
        reportedErratumUrl: sanitizeExternalUrl(reportedErratumUrl),
      },
    });

    // 画像は投稿の作成後にクライアントが別途アップロードするため id を返す
    return { id: report.id };
  } catch (error) {
    console.error(error);
    return { error: "投稿に失敗しました" };
  }
}

const ReportUpdateSchema = z.object({
  status: z.enum(["PENDING", "FORWARDED", "LISTED", "WILL_FIX", "FIXED", "WONT_FIX", "DISMISSED", "OTHER"]).optional(),
  // ⚠️ 出版社からの回答はここでは受けない（PublisherComment テーブル＝ actions/publisher-comment.ts）。
  //    この欄は**運営者自身の説明**で、書き手が管理者ひとりだから列のままでよい
  statusNote: limited(REPORT_LIMITS.statusNote, "運営者の補足").nullable().optional(),
  fixedEdition: z.number().int().positive().nullable().optional(),
  fixedPrinting: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  // OTHER（その他）は「上記で表せない事情」を意味するので、説明が無いと読者に何も伝わらない。
  // 空の OTHER を作れなくすることで、迷ったときの掃きだめになるのを防ぐ。
  if (data.status === "OTHER" && !data.statusNote?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["statusNote"],
      message: "「その他」を選んだときは、運営者の補足欄に事情を記載してください",
    });
  }
}).transform((data) => {
  // 修正版・刷は「修正済み(FIXED)」でのみ意味を持つ欄。FIXED 以外へ変更するときは、
  // クライアントが何を送ってきても null に倒す。UI 側の入力欄制御だけに頼らず、ここで
  // 不変条件を保証する（アクション直叩きでも不整合な状態を保存させない ＝ createReport が
  // 「UI と同じ条件をサーバーでも強制する」のと同じ考え方）。
  // status を含まない部分更新では現在の status が不明なので、fixed* には触れない。
  if (data.status !== undefined && data.status !== "FIXED") {
    return { ...data, fixedEdition: null, fixedPrinting: null };
  }
  return data;
});

export type ReportUpdateInput = z.input<typeof ReportUpdateSchema>;
export type ReportActionState = { error?: string };

export async function updateReport(id: string, input: ReportUpdateInput): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = ReportUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.report.findUnique({ where: { id } });
      const report = await tx.report.update({
        where: { id },
        data: parsed.data,
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          // ReportUpdateSchema が受ける4項目すべてを記録する（fixedEdition/fixedPrinting は FIXED 運用の要）
          before: {
            status: before?.status,
            statusNote: before?.statusNote,
            fixedEdition: before?.fixedEdition,
            fixedPrinting: before?.fixedPrinting,
          },
          after: {
            status: report.status,
            statusNote: report.statusNote,
            fixedEdition: report.fixedEdition,
            fixedPrinting: report.fixedPrinting,
          },
        },
        tx
      );
    });

    // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

// 認可の3つ目の形態（「ログイン済み かつ その投稿の投稿者」）なので services/auth は使わない。
// ステータスは一本道なので「FORWARDED 未満」は PENDING で足りる。DISMISSED も弾く。
//
// ⚠️ ステータスの確認はトランザクションの**中**で行う。編集画面を開いている間に管理者が
//    連絡済みにする競合は現実にあり、画面を出した時点の判定では送信済みの投稿を書き換えられる。
export async function updateOwnReport(id: string, input: ReportBodyInput): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  try {
    const parsed = ReportBodySchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.report.findUnique({ where: { id } });
      if (!before) return { error: "投稿が見つかりません" };
      if (before.userId !== user.id) return { error: "この投稿を編集する権限がありません" };
      if (before.status !== "PENDING") {
        return { error: "出版社へ連絡した後の投稿は編集できません。追記でご対応ください。" };
      }

      // editedAt は投稿者が本文を触ったときだけ動かす（updatedAt は管理者の操作でも動くため）
      const after = await tx.report.update({
        where: { id },
        data: { ...parsed.data, editedAt: new Date() },
      });

      // 上書きなので他に痕跡が残らない。賛同が付いた後の書き換えを辿れる唯一の手段
      // （本人の操作を載せる前例は withdraw にもある）
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.UPDATE_OWN_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: toAuditBody(before),
          after: toAuditBody(after),
        },
        tx
      );
      return {};
    });
    if (result.error !== undefined) return result;

    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

function toAuditBody(report: Prisma.ReportGetPayload<object>) {
  return {
    title: report.title,
    type: report.type,
    medium: report.medium,
    edition: report.edition,
    printing: report.printing,
    page: report.page,
    line: report.line,
    hasMultiplePages: report.hasMultiplePages,
    locationNote: report.locationNote,
    ebookLocation: report.ebookLocation,
    wrong: report.wrong,
    correct: report.correct,
    content: report.content,
    note: report.note,
  };
}

type OwnReportWithdrawal =
  | { error: string; imageUrls?: undefined }
  | { error?: undefined; imageUrls: string[] };

/**
 * 投稿を取り下げる（投稿者本人・出版社へ連絡する前だけ）。
 *
 * 動機は「**誤った正誤情報は、無いことより有害**」。指摘そのものが丸ごと誤りだったとき、
 * これが無いと投稿者は管理者が `DISMISSED` にするのを待つしかない。
 *
 * ⭐ **投稿ごと削除する**（「取り下げ済み」として残さない）。`ReportStatus` は出版社対応の進捗を
 * 表す1軸で、可視性の状態を混ぜない方針のため = [[decision-report-status-6values]] / docs/design.md §7。
 * 連絡前に限るので、消しても出版社の対応が宙に浮くことはない。
 *
 * ⚠️ 賛同（`Upvote`）と追記は Cascade で一緒に消える。他人が付けた賛同まで消えるのは事実だが、
 *    PENDING の間しか取り下げられない＝外へ出る前なので、影響の範囲は投稿者本人の中に留まる。
 *    消えたこと自体は AuditLog の before に投稿の中身ごと残る（管理者の deleteReport と同じ）。
 */
export async function withdrawOwnReport(id: string): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  let result: OwnReportWithdrawal;
  try {
    // 認可もステータスの確認も塊の中で行う（updateOwnReport と同じ理由。画面を開いている間に
    // 管理者が連絡済みにする競合があり、画面を出した時点の判定では防げない）
    result = await prisma.$transaction(async (tx): Promise<OwnReportWithdrawal> => {
      const found = await findReportWithImages(tx, id);
      if (!found) return { error: "投稿が見つかりません" };
      if (found.userId !== user.id) {
        return { error: "この投稿を取り下げる権限がありません" };
      }
      if (found.status !== "PENDING") {
        return { error: "出版社へ連絡した後は取り下げられません。追記でご対応ください。" };
      }

      await tx.report.delete({ where: { id } });
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.WITHDRAW_OWN_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return { imageUrls: found.images.map((image) => image.imageUrl) };
    });
  } catch (error) {
    console.error(error);
    return { error: "取り下げに失敗しました" };
  }

  if (result.error !== undefined) return result;

  await removeImageFiles(result.imageUrls);

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）。
  // 投稿は消えたので元のページには戻れない。自分の投稿一覧＝残っているものが見える場所へ送る
  redirect(routes.user(user.id));
}

const AddendumSchema = z.object({
  body: limited(REPORT_LIMITS.addendum, "追記").min(1, "追記を入力してください"),
});
export type AddendumInput = z.input<typeof AddendumSchema>;
// images は**作った直後は必ず空**（画像は追記を作ってから別リクエストで送るため）。
// 呼び出し側が送り終えた分を自分の一覧に足す = components/report-addenda.tsx
export type Addendum = {
  id: string;
  body: string;
  createdAt: string;
  images: { id: string; imageUrl: string }[];
};
type AddendumResult = { addendum: Addendum; error?: undefined } | { addendum?: undefined; error: string };

// ⚠️ **refresh() しない。作った行を返し、呼び出し側が自分の一覧に足す。**
//    理由は components/report-addenda.tsx のコメント。
export async function addReportAddendum(id: string, input: AddendumInput): Promise<AddendumResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  try {
    const parsed = AddendumSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    // 追記そのものは軽いが、1件ごとに画像の枠を消費できるので回数を抑える
    const limit = await checkRateLimit(
      rateLimitKey("addReportAddendum", user.id),
      RATE_LIMITS.addReportAddendum
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) return { error: "投稿が見つかりません" };
      if (report.userId !== user.id) return { error: "この投稿に追記する権限がありません" };
      // PENDING のうちは本文を直せるので追記させない（同じことを2つの経路で言えるようにしない）
      if (report.status === "PENDING") {
        return { error: "この投稿はまだ編集できます。本文を直してください。" };
      }

      const created = await tx.reportAddendum.create({
        data: { reportId: id, body: parsed.data.body },
      });
      return {
        addendum: {
          id: created.id,
          body: created.body,
          createdAt: formatJstDateTime(created.createdAt),
          images: [],
        },
      };
    });
    return result;
  } catch (error) {
    console.error(error);
    return { error: "追記に失敗しました" };
  }
}

// 削除対象の読み出し。監査ログの before に使う値なので、削除と同じ塊の中で読む
// （読んでから消すまでの間に他の変更が入り込まないようにする）。
function findReportWithImages(client: Prisma.TransactionClient, id: string) {
  return client.report.findUnique({ where: { id }, include: { images: true } });
}

/**
 * Storage 上のファイルを消す。**必ずコミット後に呼ぶ**（取り消せない操作なので DB の確定を待つ）。
 *
 * Storage は外部サービスでトランザクションに入れられない＝原子性は諦め、「どちらに倒すか」を
 * 決めている: DB を先に消す＝**ファイルだけ残る（孤児）**。逆（ファイルを先に消す）だと
 * 画像が壊れて表示されるので、利用者に見える分だけ実害が大きい。
 *
 * 残った孤児を後から辿る手段は **`AuditLog` の `before`**（呼び出し元が消した画像の `imageUrl` を
 * そこに残している）。⚠️ `console.error` は手段にならない — Vercel Hobby の Runtime Logs は
 * 保持1時間で、気づかなければ消える（出典: https://vercel.com/docs/logs/runtime の Limits）。
 * 監査ログは DB にあり90日残るので、この記録だけが実用的な手掛かりになる。
 */
async function removeImageFiles(imageUrls: string[]) {
  const paths = imageUrls
    .map((imageUrl) => storagePathFromPublicUrl(imageUrl))
    .filter((path): path is string => path !== null);
  if (paths.length === 0) return;

  const storageAdmin = createAdminClient();
  const { error } = await storageAdmin.storage.from(REPORT_IMAGE_BUCKET).remove(paths);
  if (error) {
    // DB 側は確定済みなのでエラーにはしない。孤児ファイルの手掛かりとして記録のみ。
    console.error("画像ファイルの削除に失敗:", paths, error);
  }
}

export async function deleteReport(id: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let report: Awaited<ReturnType<typeof findReportWithImages>>;
  try {
    // 塊にする理由は「操作は成立したのに記録だけが無い」状態を作らないため。
    // 分けると「投稿は消えたが記録が無い」半端な状態が残り、しかも監査ログの失敗で
    // catch に入るため画面には「削除に失敗しました」と出る（実際は消えている）。
    // 塊にすれば、記録が残せないときは削除ごと巻き戻るので、その文言が事実になる。
    // （投稿と監査ログが同じ DB にあることは、この手段を使える条件であって理由ではない。
    //   外部サービスをまたぐ操作は包めないので、別途「どちらに倒すか」を決める＝下の Storage）
    //
    // ⚠️ 塊の中では tx を使うこと。グローバルの prisma を使うと別接続になり塊の外に出る。
    report = await prisma.$transaction(async (tx) => {
      const found = await findReportWithImages(tx, id);
      if (!found) return null;

      await tx.report.delete({ where: { id } });
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT,
          targetType: TARGET_TYPE.REPORT,
          targetId: id,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }

  if (!report) {
    return { error: "投稿が見つかりません" };
  }

  await removeImageFiles(report.images.map((image) => image.imageUrl));

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.reports);
}

/**
 * 添付画像を1枚だけ削除する（管理者のみ）。
 *
 * 動機は権利者対応の実効性。「この画像だけ消してほしい」と言われたとき、これが無いと
 * 投稿ごと消すか Supabase の管理画面で行とファイルを手作業で消すしかない
 * （docs/moderation-policy.md の「部分マスキング」と同じ系統の措置）。
 *
 * 投稿本文には触れない＝**投稿を消さずに済ませる**ための手段であることが要点。
 */
export async function deleteReportImage(imageId: string): Promise<ReportActionState> {
  const admin = await requireAdminServerAction();

  let image: Awaited<ReturnType<typeof prisma.reportImage.findUnique>>;
  try {
    // deleteReport と同じ形: 行の削除と監査ログを1つの塊にする。
    // ⚠️ 権利者からの削除要請に応じた証跡なので、**記録が残せないなら削除も成立させない**方が正しい。
    // 「記録だけが無い」状態を作らないことが目的で、同じ DB であることは条件にすぎない。
    image = await prisma.$transaction(async (tx) => {
      const found = await tx.reportImage.findUnique({ where: { id: imageId } });
      if (!found) return null;

      await tx.reportImage.delete({ where: { id: imageId } });
      // 対象は投稿（画像は投稿の一部）なので targetId は reportId にし、消した画像を before に残す。
      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.DELETE_REPORT_IMAGE,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: found as Record<string, unknown>,
        },
        tx
      );
      return found;
    });
  } catch (error) {
    console.error(error);
    return { error: "画像の削除に失敗しました" };
  }

  if (!image) {
    return { error: "画像が見つかりません" };
  }

  await removeImageFiles([image.imageUrl]);

  refresh();
  return {};
}

type OwnImageDeletion =
  | { error: string; imageUrl?: undefined }
  | { error?: undefined; imageUrl: string };

/**
 * 添付画像を1枚だけ削除する（投稿者本人・出版社へ連絡する前だけ）。
 *
 * 削除を PENDING に限るのは、本文を凍結しても画像を消せるなら**出版社が見た内容は結局変わる**ため。
 * 追加の方は追記と同じ「足すだけ」の操作なので、連絡後も開いている（api/reports/[id]/images）。
 *
 * ⚠️ 管理者用の deleteReportImage とは別に置く。あちらは権利者からの削除要請に応える措置で、
 *    ステータスに関わらず消せる必要があり、条件を共有すると両方の意図が濁る。
 */
export async function deleteOwnReportImage(imageId: string): Promise<ReportActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "認証が必要です" };
  }

  let result: OwnImageDeletion;
  try {
    result = await prisma.$transaction(async (tx): Promise<OwnImageDeletion> => {
      // 認可もステータスの確認も塊の中で行う（updateOwnReport と同じ理由。詳細ページを開いて
      // いる間に管理者が連絡済みにする競合があり、画面を出した時点の判定では防げない）
      const found = await tx.reportImage.findUnique({
        where: { id: imageId },
        include: { report: { select: { userId: true, status: true } } },
      });
      if (!found) return { error: "画像が見つかりません" };
      if (found.report.userId !== user.id) {
        return { error: "この画像を削除する権限がありません" };
      }
      if (found.report.status !== "PENDING") {
        return { error: "出版社へ連絡した後は画像を削除できません。" };
      }

      await tx.reportImage.delete({ where: { id: imageId } });
      // 消せる期間でも記録は残す。上書きと同じで、消した後は画像があったことを辿る手段が
      // これしかない（賛同が付いた後に根拠だけ消える形を検知できるようにしておく）。
      // 対象は投稿（画像は投稿の一部）なので targetId は reportId にする。
      await createAuditLog(
        {
          userId: user.id,
          userEmail: user.email,
          action: AUDIT_ACTION.DELETE_OWN_REPORT_IMAGE,
          targetType: TARGET_TYPE.REPORT,
          targetId: found.reportId,
          before: { id: found.id, imageUrl: found.imageUrl },
        },
        tx
      );
      return { imageUrl: found.imageUrl };
    });
  } catch (error) {
    console.error(error);
    return { error: "画像の削除に失敗しました" };
  }

  if (result.error !== undefined) return { error: result.error };

  await removeImageFiles([result.imageUrl]);

  // ⚠️ refresh() しない。呼び出し側（report-images.tsx）は追加も削除も自分の state で持っており、
  //    サーバーを描き直しても初期値としては読まれない＝往復が増えるだけになる。
  return {};
}

export type UpvoteResult = { upvoted: boolean; count: number; error?: undefined } | { error: string };

function countUpvotes(reportId: string) {
  return prisma.upvote.count({ where: { reportId } });
}

/**
 * 賛同を付ける / 取り消す。自分の投稿には不可。
 * 付与の重複は @@unique 制約で、取り消しの空振りは deleteMany で、どちらも冪等に扱う。
 */
export async function toggleUpvote(reportId: string, upvote: boolean): Promise<UpvoteResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "認証が必要です" };
    }

    // 付与・取り消しのどちらも数える（連打は両方向に等しく発生するため）
    const limit = await checkRateLimit(
      rateLimitKey("toggleUpvote", user.id),
      RATE_LIMITS.toggleUpvote
    );
    if (!limit.allowed) {
      return { error: rateLimitMessage(limit.retryAfterSec) };
    }

    if (upvote) {
      const report = await prisma.report.findUnique({ where: { id: reportId }, select: { userId: true } });
      if (!report) {
        return { error: "投稿が見つかりません" };
      }
      if (report.userId === user.id) {
        return { error: "自分の投稿には賛同できません" };
      }

      try {
        await prisma.upvote.create({ data: { reportId, profileId: user.id } });
      } catch (e) {
        // P2002 = unique 制約違反（すでに賛同済み）。二重クリック等を想定し成功扱いにする。
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    } else {
      await prisma.upvote.deleteMany({ where: { reportId, profileId: user.id } });
    }

    return { upvoted: upvote, count: await countUpvotes(reportId) };
  } catch (error) {
    console.error(error);
    return { error: upvote ? "賛同に失敗しました" : "賛同の取り消しに失敗しました" };
  }
}
