"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { Publisher } from "@/generated/prisma/client";
import {
  createPublisher,
  updatePublisher,
  deletePublisher,
  type PublisherState,
} from "@/features/publisher/actions/publisher";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";

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
          <label htmlFor="publisher-name" className="block text-sm font-medium text-gray-700 mb-1">
            出版社名 <span className="text-red-700">*</span>
          </label>
          <input
            id="publisher-name"
            name="name"
            defaultValue={publisher?.name ?? ""}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="publisher-email" className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input
            id="publisher-email"
            name="email"
            type="email"
            defaultValue={publisher?.email ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="publisher-email-domain" className="block text-sm font-medium text-gray-700 mb-1">
            メールドメイン
          </label>
          <input
            id="publisher-email-domain"
            name="emailDomain"
            placeholder="例: oreilly.co.jp"
            defaultValue={publisher?.emailDomain ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            連絡先を控えておくためのメモです。アクセス権の判定には使いません（付与は各ユーザーの編集画面から個別に行います）
          </p>
        </div>

        <div>
          <label htmlFor="publisher-note" className="block text-sm font-medium text-gray-700 mb-1">備考</label>
          <textarea
            id="publisher-note"
            name="note"
            defaultValue={publisher?.note ?? ""}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-700">{state.error}</p>
        )}
        {deleteError && (
          <p className="text-sm text-red-700">{deleteError}</p>
        )}

        <div className="flex gap-3 justify-between pt-2">
          <div className="flex gap-3">
            <Button type="submit" disabled={pending} className="px-6">
              {pending ? "送信中..." : submitLabel}
            </Button>
            <Button
              type="button"
              onClick={() => router.push(routes.admin.publishers)}
              variant="secondary"
              className="px-6"
            >
              キャンセル
            </Button>
          </div>
          {isEdit && (
            <Button type="button" onClick={handleDelete} variant="dangerOutline">
              削除
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
