import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { routes } from "@/constants/routes";
import { DisplayNameForm } from "./display-name-form";
import { ProfileLinksForm } from "./profile-links-form";

// アカウント設定ページ。アカウント情報の表示、表示名の変更、退会（Danger Zone）。
// セルフサービスは表示名変更と退会のみ。メール変更機能は提供しない（需要が低く、
// 変更したい場合は別アカウント作成を想定）。個人情報の訂正請求は一般ルートとして
// プライバシーポリシー第7条1項の窓口で受け付ける。
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
    select: { displayName: true, githubUsername: true, xUsername: true, createdAt: true },
  });

  // GitHub ログイン済みなら OAuth の identity から本人のアカウント名を取り、
  // 未入力時のプリフィル候補として渡す（保存＝公開は本人の操作のみ）。
  const githubIdentity = user.identities?.find((i) => i.provider === "github");
  const githubUsernameSuggestion =
    (githubIdentity?.identity_data?.user_name as string | undefined) ?? null;

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
            {profile?.createdAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">登録日</dt>
                <dd className="text-gray-900">{profile.createdAt.toISOString().split("T")[0]}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">表示名の変更</h2>
          <DisplayNameForm currentDisplayName={profile?.displayName ?? null} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">公開リンク</h2>
          <ProfileLinksForm
            currentGithubUsername={profile?.githubUsername ?? null}
            currentXUsername={profile?.xUsername ?? null}
            githubUsernameSuggestion={githubUsernameSuggestion}
          />
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
