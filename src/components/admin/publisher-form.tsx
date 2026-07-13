"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { Publisher } from "@/generated/prisma/client";
import {
  createPublisher,
  updatePublisher,
  deletePublisher,
  type PublisherState,
} from "@/app/actions/publisher";
import { routes } from "@/constants/routes";

export default function PublisherForm({ publisher }: { publisher?: Publisher }) {
  const router = useRouter();
  const isEdit = !!publisher;

  const action = isEdit
    ? updatePublisher.bind(null, publisher.id)
    : createPublisher;
  const submitLabel = isEdit ? "更新する" : "追加する";

  const [state, formAction, pending] = useActionState<PublisherState, FormData>(
    action,
    undefined
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!publisher) return;
    if (!confirm("この出版社を削除しますか？（書籍が紐づいている場合は削除できません）")) return;
    setDeleteError(null);
    const result = await deletePublisher(publisher.id);
    if (result?.error) setDeleteError(result.error);
  }

  return (
    <div className="max-w-lg">
      <form action={formAction} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            出版社名 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            defaultValue={publisher?.name ?? ""}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input
            name="email"
            type="email"
            defaultValue={publisher?.email ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールドメイン
          </label>
          <input
            name="emailDomain"
            placeholder="例: oreilly.co.jp"
            defaultValue={publisher?.emailDomain ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            このドメインのメアドで登録したユーザーに自動でアクセス権を付与します
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
          <textarea
            name="note"
            defaultValue={publisher?.note ?? ""}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-500">{state.error}</p>
        )}
        {deleteError && (
          <p className="text-sm text-red-500">{deleteError}</p>
        )}

        <div className="flex gap-3 justify-between pt-2">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "保存中..." : submitLabel}
            </button>
            <button
              type="button"
              onClick={() => router.push(routes.admin.publishers)}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              削除
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
