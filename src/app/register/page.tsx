import Link from "next/link";
import { routes } from "@/constants/routes";
import {
  GitHubSignInButton,
  GoogleSignInButton,
} from "@/features/account/components/oauth-sign-in-buttons";
import { LegalConsentNote } from "@/components/layout/legal";

// 会員登録は GitHub / Google のアカウントだけで受け付ける（初回のログインが登録を兼ねる）。
// メールアドレスでの登録は閉じている＝理由と、開け直すときに一緒に直すものは docs/design.md §7。
export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">会員登録</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-sm text-gray-600">GitHub または Google のアカウントで登録できます。</p>
          {/* 表示名は投稿者名として公開される。以前はフォームで本人に決めてもらっていたが、
              今は初期値がプロフィールの名前（Google はほぼ実名）になるので、押す前に知らせる */}
          <p className="text-xs text-gray-500">
            表示名（投稿者名として公開されます）の初期値は、GitHub / Google に登録している名前です。登録後にアカウント設定で変更できます。
          </p>

          <div className="space-y-2">
            <GitHubSignInButton />
            <GoogleSignInButton />
          </div>

          <LegalConsentNote action="登録" />

          <p className="text-center text-sm text-gray-500">
            すでにアカウントをお持ちの方は
            <Link href={routes.login} className="text-blue-600 hover:underline ml-1">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
