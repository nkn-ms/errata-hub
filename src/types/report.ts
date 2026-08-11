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
  // 投稿者が本文を編集した時刻の ISO（未編集なら null）。管理者のステータス更新では付かない。
  // 表示側で日付だけ／日付＋時刻を選べるよう整形しないまま渡す
  editedAtIso: string | null;
  // 出版社へ連絡した後に投稿者が足した追記（古い順）。作成後は変えられない
  addenda: { id: string; body: string; createdAt: string; images: ReportImageView[] }[];
  // 相対表記（「3時間前」等）を出すための生タイムスタンプ（ISO）。新着フィードのカードで使う。
  createdAtIso: string;
  upvoteCount: number;
  // 投稿本体の画像（古い順）。追記に添えた画像は addenda の中に入る
  images: ReportImageView[];
};

/**
 * 表示側に渡す画像1枚。
 *
 * ⭐ **運営者が削除した画像は `imageUrl` を持たない**。Storage のファイルは実際に消えるので、
 * URL を渡せば壊れた画像になる。「表示できない」ことを型で保証し、表示側に墓標
 * （「運営者が削除しました」）への分岐を強制するのが狙い（規約第6条3項の明示義務）。
 * 行ごと消さない理由は schema.prisma の ReportImage.removedByOperatorAt を参照。
 */
export type ReportImageView =
  | { id: string; removedByOperator: false; imageUrl: string }
  | { id: string; removedByOperator: true; imageUrl?: undefined };
