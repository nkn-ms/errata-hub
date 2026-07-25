"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { GitHubSignInButton } from "@/components/github-sign-in-button";
import { LegalConsentNote } from "@/components/legal";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        {/* GitHub ボタンも <form> なので、ネストを避けるためカードは div にして form を分ける */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <form action={action} className="space-y-4">
          {state?.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "ログイン中..." : "ログイン"}
          </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">または</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <GitHubSignInButton />

          {/* GitHubログインは初回に新規登録を兼ねる（同一メール自動リンク/新規作成）ため、ログイン画面にも同意文言を出す */}
          <LegalConsentNote action="ログイン" />

          <p className="text-center text-sm">
            <Link href={routes.auth.resetPassword} className="text-blue-600 hover:underline">
              パスワードをお忘れですか？
            </Link>
          </p>

          <p className="text-center text-sm text-gray-500">
            アカウントをお持ちでない方は
            <Link href={routes.register} className="text-blue-600 hover:underline ml-1">
              会員登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
