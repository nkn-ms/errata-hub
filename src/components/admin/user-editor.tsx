"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Publisher, PublisherAccess } from "@/generated/prisma/client";
import { routes } from "@/constants/routes";

type ProfileWithAccess = Profile & {
  publisherAccess: (PublisherAccess & { publisher: Publisher })[];
};

const ROLES = [
  { value: "ADMIN", label: "管理者" },
  { value: "USER", label: "一般" },
] as const;

export default function AdminUserEditor({
  profile,
  publishers,
}: {
  profile: ProfileWithAccess;
  publishers: Publisher[];
}) {
  const router = useRouter();
  const [role, setRole] = useState(profile.role);
  const [access, setAccess] = useState(profile.publisherAccess);
  const [saving, setSaving] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [selectedPublisherId, setSelectedPublisherId] = useState("");

  const grantedIds = new Set(access.map((a) => a.publisherId));
  const ungrantedPublishers = publishers.filter((p) => !grantedIds.has(p.id));

  async function handleSaveRole() {
    setSaving(true);
    setRoleSaved(false);
    await fetch(routes.api.adminUser(profile.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(false);
    setRoleSaved(true);
    router.refresh();
  }

  async function handleAddPublisher() {
    if (!selectedPublisherId) return;
    const res = await fetch(routes.api.adminUserPublishers(profile.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publisherId: selectedPublisherId }),
    });
    if (res.ok) {
      const newAccess = await res.json();
      setAccess((prev) => [...prev, newAccess]);
      setSelectedPublisherId("");
      setAccessMessage("追加しました");
    }
  }

  async function handleRemovePublisher(publisherId: string) {
    await fetch(routes.api.adminUserPublishers(profile.id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publisherId }),
    });
    setAccess((prev) => prev.filter((a) => a.publisherId !== publisherId));
    setAccessMessage("削除しました");
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* ロール変更 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">ロール</h2>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                role === r.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSaveRole}
          disabled={saving || role === profile.role}
          className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : "ロールを保存"}
        </button>
        {roleSaved && <p className="text-sm text-green-600">保存しました</p>}
      </div>

      {/* 出版社アクセス */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">出版社アクセス権限</h2>

        {access.length === 0 ? (
          <p className="text-sm text-gray-400">付与された出版社なし</p>
        ) : (
          <ul className="space-y-2">
            {access.map((a) => (
              <li key={a.publisherId} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{a.publisher.name}</span>
                <button
                  onClick={() => handleRemovePublisher(a.publisherId)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}

        {accessMessage && <p className="text-sm text-green-600">{accessMessage}</p>}
        {ungrantedPublishers.length > 0 && (
          <div className="flex gap-2 pt-2">
            <select
              value={selectedPublisherId}
              onChange={(e) => setSelectedPublisherId(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">出版社を選択...</option>
              {ungrantedPublishers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddPublisher}
              disabled={!selectedPublisherId}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              追加
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => router.push(routes.admin.users)}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← 一覧へ戻る
      </button>
    </div>
  );
}
