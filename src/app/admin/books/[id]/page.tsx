import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdminBookEditor } from "@/components/admin/book-editor";

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      publisher: { select: { name: true } },
      _count: { select: { reports: true } },
    },
  });

  if (!book) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">書籍を編集</h1>
        <p className="mt-1 text-sm text-gray-500">{book.title}</p>
      </div>

      <AdminBookEditor
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisherName: book.publisher?.name ?? null,
          coverImageUrl: book.coverImageUrl,
          erratumUrl: book.erratumUrl,
          reportCount: book._count.reports,
        }}
      />
    </div>
  );
}
