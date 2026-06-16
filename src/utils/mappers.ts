import type { Report as PrismaReport, Book, Publisher, ReportImage, Profile } from "@/generated/prisma/client";
import type { Report } from "@/types/report";
import { STATUS_LABELS } from "@/constants/report-status";

type PrismaReportWithRelations = PrismaReport & {
  book: Book & { publisher: Publisher | null };
  images: ReportImage[];
  user?: Pick<Profile, "displayName"> | null;
};

export function mapReport(f: PrismaReportWithRelations): Report {
  return {
    id: f.id,
    bookId: f.bookId,
    userId: f.userId,
    userName: f.user?.displayName ?? "匿名",
    userIdShort: f.userId.slice(0, 8),
    title: f.title,
    bookTitle: f.book.title,
    bookAuthor: f.book.author ?? "",
    publisher: f.book.publisher?.name ?? "",
    isbn: f.book.isbn ?? "",
    coverImage: f.book.coverImageUrl ?? "",
    edition: f.edition ?? undefined,
    printing: f.printing ?? undefined,
    type: mapType(f.type),
    locationType: mapLocationType(f.locationType),
    page: f.page ?? undefined,
    line: f.line ?? undefined,
    hasMultiplePages: f.hasMultiplePages,
    locationNote: f.locationNote ?? undefined,
    kindleLocation: f.kindleLocation ?? undefined,
    wrong: f.wrong ?? undefined,
    correct: f.correct ?? undefined,
    content: f.content ?? undefined,
    note: f.note ?? undefined,
    publisherComment: f.publisherComment ?? undefined,
    status: mapStatus(f.status),
    fixedEdition: f.fixedEdition ?? undefined,
    fixedPrinting: f.fixedPrinting ?? undefined,
    createdAt: f.createdAt.toISOString().split("T")[0],
  };
}

function mapType(type: PrismaReport["type"]): Report["type"] {
  const map = {
    TYPO: "誤字脱字",
    ERRATA: "正誤情報",
    READABILITY: "読みにくい",
    OTHER: "その他",
  } as const;
  return map[type];
}

function mapLocationType(type: PrismaReport["locationType"]): Report["locationType"] {
  const map = {
    PAGE: "ページ",
    KINDLE: "Kindle",
    OTHER: "その他",
  } as const;
  return map[type];
}

function mapStatus(status: PrismaReport["status"]): Report["status"] {
  return STATUS_LABELS[status] as Report["status"];
}
