import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * **出版社の読み取り（Data Access Layer）。** 条件と根拠は features/report/db/queries.ts の冒頭と同じ。
 *
 * ⚠️ **出版社の情報は管理画面にしか出ない**（`Publisher.email` は連絡先で、公開ページには出さない
 * = schema.prisma）。認可は app/admin/layout.tsx の requireAdminPage() が担う。
 */

/** 出版社マスタ一覧の1行。 */
export type AdminPublisherRow = {
  id: string;
  name: string;
  email: string | null;
  emailDomain: string | null;
  bookCount: number;
  accessCount: number;
};

/** 出版社マスタ一覧（名前順）と総件数。 */
export async function findPublishersPageForAdmin(
  page: number,
  pageSize: number
): Promise<{ publishers: AdminPublisherRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.publisher.findMany({
      include: { _count: { select: { books: true, publisherAccess: true } } },
      // 出版社名は一意ではない（同名が入りうる）。id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.publisher.count(),
  ]);

  return {
    publishers: rows.map((publisher) => ({
      id: publisher.id,
      name: publisher.name,
      email: publisher.email,
      emailDomain: publisher.emailDomain,
      bookCount: publisher._count.books,
      accessCount: publisher._count.publisherAccess,
    })),
    total,
  };
}

/** 編集フォームが必要とする範囲。`PublisherForm` にそのまま渡る。 */
export type PublisherFormValue = {
  id: string;
  name: string;
  email: string | null;
  emailDomain: string | null;
  note: string | null;
};

/** アクセス権を持つ1人。「誰が・いつ・誰の判断で」まで見せる（画面の説明責任）。 */
export type PublisherMember = {
  accessId: string;
  profileId: string;
  displayName: string | null;
  email: string;
  grantedAt: Date;
  /** 付与した管理者。null = 付与者の記録が無い行（廃止した自動付与の時代のもの）。 */
  grantedByEmail: string | null;
};

/** 出版社の詳細（担当ユーザー付き）。 */
export type AdminPublisher = PublisherFormValue & { members: PublisherMember[] };

export async function findPublisherForAdmin(id: string): Promise<AdminPublisher | null> {
  const publisher = await prisma.publisher.findUnique({
    where: { id },
    include: {
      // 誰がこの出版社のアクセス権を持っているか。付与が新しい順に並べる
      publisherAccess: {
        include: { profile: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!publisher) return null;

  return {
    id: publisher.id,
    name: publisher.name,
    email: publisher.email,
    emailDomain: publisher.emailDomain,
    note: publisher.note,
    members: publisher.publisherAccess.map((access) => ({
      accessId: access.id,
      profileId: access.profile.id,
      displayName: access.profile.displayName,
      email: access.profile.email,
      grantedAt: access.createdAt,
      grantedByEmail: access.grantedByEmail,
    })),
  };
}

/** 付与先を選ぶプルダウン用（名前順）。 */
export type PublisherOption = { id: string; name: string };

export function findPublisherOptions(): Promise<PublisherOption[]> {
  return prisma.publisher.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
