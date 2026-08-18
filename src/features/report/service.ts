import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * 投稿のクエリを集約するサービス層。
 *
 * 一覧・詳細で共通して使う include 形（書籍・出版社・画像・投稿者名）をここで一元管理し、
 * 各ページ（サーバーコンポーネント）はこの関数を直接 await して使う。
 * HTTP 越しの自前 API は挟まない（同一プロセスなら関数呼び出しの方が速くクリーン）。
 */
export const reportInclude = {
  book: { include: { publisher: true } },
  images: true,
  // 追記は古い順（読む順が 投稿 → 追記1 → 追記2 と時系列になる）。
  // 画像は追記に添えて足せるので一緒に引く（投稿本体の画像とは別扱い = schema.prisma）
  addenda: { orderBy: { createdAt: "asc" }, include: { images: true } },
  // 出版社からの回答も古い順（やりとりの順に読める）。出版社名は行が持つ publisherId で引く
  // ＝書籍の出版社を管理者が後から直しても、過去の回答の帰属が変わらない（schema.prisma）
  publisherComments: {
    orderBy: { createdAt: "asc" },
    include: { publisher: { select: { name: true } } },
  },
  // email は退会判定（匿名化メールか）にのみ使い、クライアントへは渡さない（mapReport で破棄）。
  user: { select: { displayName: true, email: true } },
  _count: { select: { upvotes: true } },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

/**
 * トップの新着フィード用。1ページ分の投稿（新着順）と総件数を返す。
 * skip/take でサーバー側ページングするので、11件目以降も ?page=N で辿れる
 * （古い投稿が導線から消えないようにするのが目的）。
 */
export async function findReportsPage(page: number, pageSize: number) {
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      include: reportInclude,
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count(),
  ]);
  return { reports, total };
}

/**
 * /reports（検索・一覧ページ）用の全投稿（新着順）。
 * 絞り込み・並べ替え・ページ送りはクライアント側テーブル（report-table.tsx）が担うため全件返す。
 *
 * ⚠️ **投稿が 1,000 件を超えたら、ここをサーバー側のページングへ切り替える**（2026-08-06 決定）。
 *
 * 全件をブラウザへ送る代わりに、キーを打つたびの即時絞り込みが成立している＝意図した設計であって、
 * 直し忘れではない。ただし送る量は件数に比例するので天井がある。
 * 実測（合成データの JSON バイト長）: 典型的な1件 940B・全欄が上限＋画像5枚で 19KB
 * ＝ **件数だけでは重さが決まらない**（内訳で20倍ぶれる）。1,000 件は「ここで壊れる」線ではなく
 * 「ここから先は放置しないと決めた」線で、典型なら 0.9MB、実装の助走が取れるうちに動くための数字。
 *
 * 切り替えるときに一緒に済ませること:
 *   - 絞り込みは必ず DB（where）へ移す。手元に1ページ分しか無い状態で JS で絞ると
 *     「今のページの中だけ検索」という別物になる。検索語・種別・ステータスは URL へ（?q= は既にある）
 *   - この include から images を外す（一覧はカードも表も画像を出さない。bookAuthor・note も未使用）
 *   - ?page=N が付くので canonical の扱いを決める。トップと同じ「各ページに自分自身」であって、
 *     /reports に集約している今の宣言（app/(site)/reports/page.tsx）のままにはできない
 */
export function findAllReports() {
  return prisma.report.findMany({
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** ID 指定で1件取得（存在しなければ null）。 */
export function findReportById(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: reportInclude,
  });
}

/** 特定ユーザーの投稿一覧（最新順）。 */
export function findReportsByUser(userId: string) {
  return prisma.report.findMany({
    where: { userId },
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
}
