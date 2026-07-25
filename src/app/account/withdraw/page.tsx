"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { withdraw } from "@/app/actions/auth";
import { routes } from "@/constants/routes";

export default function WithdrawPage() {
  const [state, action, pending] = useActionState(withdraw, undefined);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">退会の確認</h1>
          <p className="mt-2 text-sm text-gray-500">Errata Hub</p>
        </div>

        <form action={action} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          {state?.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="text-sm text-gray-700 space-y-2">
            <p>退会すると、以下の処理が行われます。</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>アカウントとログイン情報が削除されます（再ログインできなくなります）。</li>
              <li>メールアドレス・表示名などの個人情報が削除されます。</li>
              <li>
                これまでに投稿した正誤情報・改善提案は、
                <strong>「退会済みユーザー」の投稿として残ります</strong>
                （コミュニティの情報として保全されます）。
              </li>
            </ul>
            <p className="text-red-700 font-medium">この操作は取り消せません。</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>上記を理解し、退会することに同意します。</span>
          </label>

          <button
            type="submit"
            disabled={!confirmed || pending}
            className="w-full py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "退会処理中..." : "退会する"}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link href={routes.account} className="text-blue-600 hover:underline">
              キャンセルして戻る
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
