export type ReportType = "正誤情報" | "改善提案" | "その他";
export type StatusType =
  | "未対応"
  | "出版社へ送信済み"
  | "出版社確認中"
  | "出版社回答済み"
  | "修正予定"
  | "修正済み"
  | "対応なし"
  | "却下";
export type LocationType = "ページ" | "Kindle" | "その他";

export type Report = {
  id: string;
  bookId: string;
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
  locationType: LocationType;
  page?: number;
  line?: number;
  hasMultiplePages?: boolean;
  locationNote?: string;
  kindleLocation?: string;
  wrong?: string;
  correct?: string;
  content?: string;
  note?: string;
  publisherComment?: string;
  status: StatusType;
  fixedEdition?: number;
  fixedPrinting?: number;
  createdAt: string;
  upvoteCount: number;
};

