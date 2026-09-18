import { redirect } from "next/navigation";
import { findBooksPageForAdmin } from "@/features/book/db/books";
import { AdminBookTable } from "./book-table";
import { ADMIN_PAGE_SIZE, AdminPagination } from "../pagination";
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

  const { books, total } = await findBooksPageForAdmin(page, ADMIN_PAGE_SIZE);

  const { totalPages, isOutOfRange, from, to } = paginate(page, total, ADMIN_PAGE_SIZE);
  if (isOutOfRange) redirect(pageHref(totalPages));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">書籍マスタ</h1>
        <p className="mt-1 text-sm text-gray-500">全 {total} 件</p>
      </div>

      <AdminBookTable books={books} />

      <AdminPagination page={page} totalPages={totalPages} from={from} to={to} total={total} href={pageHref} />
    </div>
  );
}
