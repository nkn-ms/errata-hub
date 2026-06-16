"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { STATUS_LABELS } from "@/constants/feedback-status";
import { routes } from "@/constants/routes";
import type { FeedbackStatus } from "@/generated/prisma/client";

type Status = FeedbackStatus;

type Props = {
  id: string;
  currentStatus: Status;
  currentComment: string;
  currentFixedEdition?: number | null;
  currentFixedPrinting?: number | null;
};

export function AdminFeedbackEditor({ id, currentStatus, currentComment, currentFixedEdition, currentFixedPrinting }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(currentStatus);
  const [comment, setComment] = useState(currentComment);
  const [fixedEdition, setFixedEdition] = useState<string>(currentFixedEdition?.toString() ?? "");
  const [fixedPrinting, setFixedPrinting] = useState<string>(currentFixedPrinting?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm("このフィードバックを削除しますか？この操作は取り消せません。")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(routes.api.feedback(id), { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push(routes.admin.feedbacks);
      router.refresh();
    } catch {
      setError("削除に失敗しました。");
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(routes.api.feedback(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          publisherComment: comment || null,
          fixedEdition: status === "FIXED" && fixedEdition ? parseInt(fixedEdition) : null,
          fixedPrinting: status === "FIXED" && fixedPrinting ? parseInt(fixedPrinting) : null,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
    } catch {
      setError("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">ステータス・対応記録</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatus(s); setSaved(false); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {status === "FIXED" && (
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">修正済みの版</label>
            <input
              type="number"
              min={1}
              value={fixedEdition}
              onChange={(e) => { setFixedEdition(e.target.value); setSaved(false); }}
              placeholder="例: 2"
              className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">修正済みの刷</label>
            <input
              type="number"
              min={1}
              value={fixedPrinting}
              onChange={(e) => { setFixedPrinting(e.target.value); setSaved(false); }}
              placeholder="例: 3"
              className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">出版社コメント</label>
        <textarea
          value={comment}
          onChange={(e) => { setComment(e.target.value); setSaved(false); }}
          rows={4}
          placeholder="出版社からの回答や対応内容を記載してください"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-green-600">保存しました</p>}

      <div className="flex gap-3 justify-between">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={() => router.push(routes.admin.feedbacks)}
            className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            一覧に戻る
          </button>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}
