import type { ReportType, ReportStatus, Medium } from "@/generated/prisma/client";

export type { ReportType, ReportStatus, Medium };

// クライアントへ渡す表示用の Report。type / medium / status は Prisma enum 値のまま持ち、
// 日本語ラベルは constants/report-labels.ts・report-status.ts で表示直前に引く。
export type Report = {
  id: string;
  // 書籍への導線は URL が ISBN ベースなので isbn だけで足りる（Book の UUID はクライアントに出さない）
  userId: string;
  userName: string;
  userIdShort: string;
  isWithdrawn: boolean;
  title: string;
  bookTitle: string;
  bookAuthor: string;
  publisher: string;
  isbn: string;
  coverImage: string;
  edition?: number;
  printing?: number;
  type: ReportType;
  medium: Medium;
  page?: number;
  line?: number;
  hasMultiplePages?: boolean;
  locationNote?: string;
  ebookLocation?: string;
  wrong?: string;
  correct?: string;
  content?: string;
  note?: string;
  publisherComment?: string;
  status: ReportStatus;
  fixedEdition?: number;
  fixedPrinting?: number;
  // 表示用に整形済みの投稿日（JST・YYYY-MM-DD）。テーブルの投稿日列・並べ替え用。
  createdAt: string;
  // 相対表記（「3時間前」等）を出すための生タイムスタンプ（ISO）。新着フィードのカードで使う。
  createdAtIso: string;
  upvoteCount: number;
  imageUrls: string[];
};
