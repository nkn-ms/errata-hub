import type { Report as PrismaReport, Book, Publisher, ReportImage, Profile } from "@/generated/prisma/client";
import type { Report } from "@/types/report";
import { isWithdrawnEmail, WITHDRAWN_DISPLAY_NAME } from "@/lib/withdrawal";
import { formatJstDate, shortId } from "@/utils/format";

type PrismaReportWithRelations = PrismaReport & {
  book: Book & { publisher: Publisher | null };
  images: ReportImage[];
  user?: Pick<Profile, "displayName" | "email"> | null;
  _count?: { upvotes: number };
};

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
    createdAtIso: f.createdAt.toISOString(),
    upvoteCount: f._count?.upvotes ?? 0,
    imageUrls: f.images.map((image) => image.imageUrl),
  };
}
