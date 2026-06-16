import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublisherForm from "@/components/admin/publisher-form";

export default async function EditPublisherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const publisher = await prisma.publisher.findUnique({ where: { id } });

  if (!publisher) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">出版社を編集</h1>
        <p className="mt-1 text-sm text-gray-500">{publisher.name}</p>
      </div>
      <PublisherForm publisher={publisher} />
    </div>
  );
}
