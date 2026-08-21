"use client";

import { useActionState } from "react";
import { updatePassword } from "@/features/account/actions/auth";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">新しいパスワードの設定</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        <form action={action} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          {state?.error && (
            <Notice variant="error">
              {state.error}
            </Notice>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              新しいパスワード
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

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "更新中..." : "パスワードを更新"}
          </Button>
        </form>
      </div>
    </div>
  );
}
