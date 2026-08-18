"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/features/account/actions/auth";
import { PROFILE_LIMITS } from "@/features/account/constants";

// 表示名のセルフ変更フォーム。アカウント設定ページに埋め込む。
// 表示名は投稿に紐づいて公開されるため、変更は即時に反映される。
export function DisplayNameForm({ currentDisplayName }: { currentDisplayName: string | null }) {
  const [state, action, pending] = useActionState(updateDisplayName, undefined);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="displayName" className="block text-sm text-gray-500 mb-1">
          表示名
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={PROFILE_LIMITS.displayName}
          defaultValue={currentDisplayName ?? ""}
          placeholder="表示名を入力"
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          投稿に表示される名前です（{PROFILE_LIMITS.displayName}文字以内）。
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          表示名を更新しました。
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "更新中..." : "表示名を変更"}
      </button>
    </form>
  );
}
