import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export default async function VerifiedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">登録完了</h1>
          <p className="text-sm text-gray-600">
            メール確認が完了しました。<br />
            ログイン済みの状態です。
          </p>
          <p className="text-xs text-gray-400">{user.email}</p>
          <Link
            href={routes.home}
            className="block w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            トップページへ
          </Link>
        </div>
      </div>
    </div>
  );
}
