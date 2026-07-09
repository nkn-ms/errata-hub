"use client";

import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { GitHubSignInButton } from "@/components/github-sign-in-button";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">会員登録</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        {/* GitHub ボタンも <form> なので、ネストを避けるためカードは div にして form を分ける */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <form action={action} className="space-y-4">
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              表示名
              <span className="text-gray-400 font-normal ml-1">（投稿者名として公開されます）</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={50}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
              <span className="text-gray-400 font-normal ml-1">（8文字以上）</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "登録中..." : "会員登録"}
          </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">または</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <GitHubSignInButton />

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
