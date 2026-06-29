import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { routes } from "@/constants/routes";

// アカウント設定ページ。現状は表示情報と退会（Danger Zone）のみ。
// 表示名変更などは /users/[id] の「仮置き」と合わせて今後実装予定。
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { displayName: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-screen-md mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href={routes.home} className="text-lg font-bold text-gray-900">Errata Hub</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">アカウント設定</span>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-4">アカウント情報</h1>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">メールアドレス</dt>
              <dd className="text-gray-900 break-all">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">表示名</dt>
              <dd className="text-gray-900">{profile?.displayName ?? "未設定"}</dd>
            </div>
            {profile?.createdAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">登録日</dt>
                <dd className="text-gray-900">{profile.createdAt.toISOString().split("T")[0]}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <h2 className="text-base font-semibold text-red-700 mb-2">退会</h2>
          <p className="text-sm text-gray-600 mb-4">
            退会するとアカウントとログイン情報が削除されます。
            これまでに投稿した内容は「退会済みユーザー」の投稿として残ります。
          </p>
          <Link
            href={routes.accountWithdraw}
            className="inline-block text-sm border border-red-300 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 transition-colors"
          >
            退会手続きへ進む
          </Link>
        </div>

        <div>
          <Link href={routes.home} className="text-sm text-gray-500 hover:text-gray-700">← トップへ戻る</Link>
        </div>
      </main>
    </div>
  );
}
