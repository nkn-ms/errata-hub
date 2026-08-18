import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminBookTable } from "@/features/book/components/admin/book-table";
import { ADMIN_PAGE_SIZE, AdminPagination } from "@/components/admin/pagination";
import { routes } from "@/constants/routes";
import { paginate } from "@/utils/pagination";
import { toPageNumber } from "@/utils/parse";

type Props = {
  searchParams: Promise<{ page?: string }>;
};

const pageHref = (n: number) => `${routes.admin.books}?page=${n}`;

export default async function AdminBooksPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = toPageNumber(pageParam);

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      include: {
        publisher: { select: { name: true } },
        _count: { select: { reports: true } },
      },
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.book.count(),
  ]);

  const { totalPages, isOutOfRange, from, to } = paginate(page, total, ADMIN_PAGE_SIZE);
  if (isOutOfRange) redirect(pageHref(totalPages));

  const rows = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    publisherName: b.publisher?.name ?? null,
    reportCount: b._count.reports,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">書籍マスタ</h1>
        <p className="mt-1 text-sm text-gray-500">全 {total} 件</p>
      </div>

      <AdminBookTable books={rows} />

      <AdminPagination page={page} totalPages={totalPages} from={from} to={to} total={total} href={pageHref} />
    </div>
  );
}
