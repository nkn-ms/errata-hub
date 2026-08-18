"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/features/account/actions/auth";
import Link from "next/link";
import { routes } from "@/constants/routes";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">パスワードの再設定</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        <form action={action} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          {state?.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <p className="text-sm text-gray-600">
            登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
          </p>

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

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "送信中..." : "再設定リンクを送信"}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link href={routes.login} className="text-blue-600 hover:underline">
              ログインに戻る
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
