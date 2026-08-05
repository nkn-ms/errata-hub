import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminUserEditor from "@/components/admin/user-editor";
import { requireAdminPage } from "@/services/auth";
import { isWithdrawnEmail } from "@/lib/withdrawal";
import { authUserExists } from "@/services/withdrawal";
import type { Profile } from "@/generated/prisma/client";

/**
 * 代行退会させられない理由を返す（実行できるなら null）。
 * 同じ判定はサーバーアクション（withdrawUserAsAdmin）側にもあり、そちらが正の砦。
 * ここは「押せないボタンを出さない・理由を先に見せる」ための画面側の判定。
 * 退会済みかの判定は email を見るためサーバー（ここ）だけで行う。
 *
 * ⚠️ 「退会済み」は Profile のスクラブだけでは決まらない。auth.users が残っていれば
 * それは途中で止まった退会で、**ここから完了させられる必要がある**（理由は
 * services/withdrawal.ts の authUserExists）。そのため auth 側の確認を重ねる。
 */
async function getWithdrawBlockedReason(profile: Profile, adminId: string): Promise<string | null> {
  if (profile.id === adminId) return "自分自身を退会させることはできません。";
  if (isWithdrawnEmail(profile.email) && !(await authUserExists(profile.id))) {
    return "このユーザーは既に退会済みです。";
  }
  if (profile.role === "ADMIN") {
    return "管理者は退会させられません。先にロールを「一般」に変更してください。";
  }
  return null;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 「自分自身か」の判定に実行者が要る（レイアウトでも認可済みだが user は渡ってこない）
  const admin = await requireAdminPage();

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
      <AdminUserEditor
        profile={profile}
        publishers={publishers}
        withdrawBlockedReason={await getWithdrawBlockedReason(profile, admin.id)}
      />
    </div>
  );
}
