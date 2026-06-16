import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminUserEditor from "@/components/admin/user-editor";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [profile, publishers] = await Promise.all([
    prisma.profile.findUnique({
      where: { id },
      include: { publisherAccess: { include: { publisher: true } } },
    }),
    prisma.publisher.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!profile) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">ユーザー編集</h1>
        <p className="mt-1 text-sm text-gray-500">{profile.email}</p>
      </div>
      <AdminUserEditor profile={profile} publishers={publishers} />
    </div>
  );
}
