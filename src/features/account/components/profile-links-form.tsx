"use client";

import { useActionState } from "react";
import { updateProfileLinks } from "@/features/account/actions/auth";
import { Button } from "@/components/ui/button";

type Props = {
  currentGithubUsername: string | null;
  currentXUsername: string | null;
  // GitHub ログイン済みの場合、OAuth 由来の本人アカウント名。未入力時のプリフィルにのみ使う
  // （保存するかは本人が「変更を保存」した時だけ＝勝手に公開しない）。
  githubUsernameSuggestion: string | null;
};

// 公開リンク（GitHub / X）のセルフ変更フォーム。アカウント設定ページに埋め込む。
// 空欄で保存すると未設定（非公開）に戻る。
export function ProfileLinksForm({
  currentGithubUsername,
  currentXUsername,
  githubUsernameSuggestion,
}: Props) {
  const [state, action, pending] = useActionState(updateProfileLinks, undefined);

  const githubDefault = currentGithubUsername ?? githubUsernameSuggestion ?? "";
  const isPrefilled = !currentGithubUsername && !!githubUsernameSuggestion;

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="githubUsername" className="block text-sm text-gray-500 mb-1">
          GitHubユーザー名
        </label>
        <div className="flex items-center">
          <span className="text-sm text-gray-400 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 bg-gray-50">
            github.com/
          </span>
          <input
            id="githubUsername"
            name="githubUsername"
            type="text"
            maxLength={39}
            defaultValue={githubDefault}
            placeholder="username"
            className="w-full text-sm border border-gray-300 rounded-r-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isPrefilled && (
          <p className="mt-1 text-xs text-blue-600">
            GitHubログインのアカウント名を入れてあります。保存すると公開されます。
          </p>
        )}
      </div>

      <div>
        <label htmlFor="xUsername" className="block text-sm text-gray-500 mb-1">
          X（Twitter）ユーザー名
        </label>
        <div className="flex items-center">
          <span className="text-sm text-gray-400 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 bg-gray-50">
            x.com/
          </span>
          <input
            id="xUsername"
            name="xUsername"
            type="text"
            maxLength={16}
            defaultValue={currentXUsername ?? ""}
            placeholder="username"
            className="w-full text-sm border border-gray-300 rounded-r-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        入力するとユーザーページにリンクとして公開されます。空欄で保存すると非公開に戻ります。
      </p>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          公開リンクを更新しました。
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "更新中..." : "公開リンクを保存"}
      </Button>
    </form>
  );
}
