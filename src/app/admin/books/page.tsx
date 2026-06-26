import { prisma } from "@/lib/prisma";
import { AdminBookTable } from "@/components/admin/book-table";

export default async function AdminBooksPage() {
  const books = await prisma.book.findMany({
    include: {
      publisher: { select: { name: true } },
      _count: { select: { reports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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
        <p className="mt-1 text-sm text-gray-500">
          全 {rows.length} 件 ・ 行をクリックすると編集・削除できます
        </p>
      </div>

      <AdminBookTable books={rows} />
    </div>
  );
}
