import type { Report as PrismaReport, Book, Publisher, ReportImage, ReportAddendum, Profile } from "@/generated/prisma/client";
import type { Report, ReportImageView } from "@/types/report";
import { isWithdrawnEmail, WITHDRAWN_DISPLAY_NAME } from "@/lib/withdrawal";
import { formatJstDate, formatJstDateTime, shortId } from "@/utils/format";

type PrismaReportWithRelations = PrismaReport & {
  book: Book & { publisher: Publisher | null };
  images: ReportImage[];
  // 必須。mapReport の呼び出し元はすべて reportInclude 経由なので必ず入る
  // （省略可にすると `?? []` という死んだ既定値を書くことになる）
  addenda: (ReportAddendum & { images: ReportImage[] })[];
  user?: Pick<Profile, "displayName" | "email"> | null;
  _count?: { upvotes: number };
};

/**
 * 画像1枚を表示用に写す。運営者が削除したものは URL を落として墓標にする
 * （型の説明は types/report.ts の ReportImageView）。
 */
export function toReportImageView(image: ReportImage): ReportImageView {
  return image.removedByOperatorAt === null
    ? { id: image.id, removedByOperator: false, imageUrl: image.imageUrl }
    : { id: image.id, removedByOperator: true };
}

export function mapReport(f: PrismaReportWithRelations): Report {
  // 退会済み（メールが匿名化済み）なら投稿者欄は「退会済みユーザー」に。
  // email 自体はここで判定に使うだけでクライアントへは出さない。
  const withdrawn = isWithdrawnEmail(f.user?.email);

  return {
    id: f.id,
    userId: f.userId,
    userName: withdrawn ? WITHDRAWN_DISPLAY_NAME : f.user?.displayName ?? "匿名",
    userIdShort: shortId(f.userId),
    isWithdrawn: withdrawn,
    title: f.title,
    bookTitle: f.book.title,
    bookAuthor: f.book.author ?? "",
    publisher: f.book.publisher?.name ?? "",
    isbn: f.book.isbn,
    coverImage: f.book.coverImageUrl ?? "",
    edition: f.edition ?? undefined,
    printing: f.printing ?? undefined,
    type: f.type,
    medium: f.medium,
    page: f.page ?? undefined,
    line: f.line ?? undefined,
    hasMultiplePages: f.hasMultiplePages,
    locationNote: f.locationNote ?? undefined,
    ebookLocation: f.ebookLocation ?? undefined,
    wrong: f.wrong ?? undefined,
    correct: f.correct ?? undefined,
    content: f.content ?? undefined,
    note: f.note ?? undefined,
    publisherComment: f.publisherComment ?? undefined,
    status: f.status,
    fixedEdition: f.fixedEdition ?? undefined,
    fixedPrinting: f.fixedPrinting ?? undefined,
    createdAt: formatJstDate(f.createdAt),
    // 整形せず ISO のまま渡すのは、詳細ページが日付＋時刻で出すため（createdAtIso と同じ理由）
    editedAtIso: f.editedAt === null ? null : f.editedAt.toISOString(),
    addenda: f.addenda.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: formatJstDateTime(a.createdAt),
      images: a.images.map(toReportImageView),
    })),
    createdAtIso: f.createdAt.toISOString(),
    upvoteCount: f._count?.upvotes ?? 0,
    // 追記に添えた画像は addenda の中に出す（混ぜると出版社が見た時点の中身が読めなくなる）
    images: f.images.filter((image) => image.addendumId === null).map(toReportImageView),
  };
}
