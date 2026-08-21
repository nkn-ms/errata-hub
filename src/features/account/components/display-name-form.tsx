"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/features/account/actions/auth";
import { PROFILE_LIMITS } from "@/features/account/constants";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

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
        <Notice variant="error">
          {state.error}
        </Notice>
      )}
      {state?.success && (
        <Notice variant="success">
          表示名を更新しました。
        </Notice>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "更新中..." : "表示名を変更"}
      </Button>
    </form>
  );
}
