"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Publisher, PublisherAccess } from "@/generated/prisma/client";
import {
  grantPublisherAccess,
  revokePublisherAccess,
  updateUserRole,
  withdrawUserAsAdmin,
} from "@/features/account/actions/user";
import { withdrawalConfirmationLabel } from "@/lib/withdrawal";
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
  roleBlockedReason,
  withdrawBlockedReason,
}: {
  profile: ProfileWithAccess;
  publishers: Publisher[];
  /** ロールを変更できない理由（自分自身）。null なら実行できる */
  roleBlockedReason: string | null;
  /** 代行退会させられない理由（自分自身・管理者・退会済み）。null なら実行できる */
  withdrawBlockedReason: string | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState(profile.role);
  const [access, setAccess] = useState(profile.publisherAccess);
  const [saving, setSaving] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [accessError, setAccessError] = useState("");
  const [selectedPublisherId, setSelectedPublisherId] = useState("");
  // アクセス権の追加・削除は**押した瞬間には送らない**（投稿の画像と同じ形 = report-edit-form.tsx）。
  // 以前は「削除」を押した時点で消えていて、押し間違いを戻す手立ても、何が消えたかを知る手立ても
  // 無かった（実際に、誰の権限が消えたのかを操作ログから逆引きする羽目になった）。
  //   removedIds … 「アクセス権を更新する」で外す既存の権限。⚠️ 一覧からは外さず薄く出す
  //   added      … 同じボタンで足す出版社（押すまでサーバーには行かない）
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<Publisher[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [withdrawConfirmation, setWithdrawConfirmation] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  // 選択肢に出さないのは「すでに持っている」＋「これから足す」の両方（同じ出版社を2回足させない）
  const listedIds = new Set([...access.map((a) => a.publisherId), ...added.map((p) => p.id)]);
  const ungrantedPublishers = publishers.filter((p) => !listedIds.has(p.id));
  const isRemoved = (publisherId: string) => removedIds.includes(publisherId);
  const hasAccessChanges = removedIds.length > 0 || added.length > 0;

  // 手入力を対象と突き合わせる（同じ判定をサーバー側でも行う。ここは押し間違いを止めるための前段）。
  const confirmationLabel = withdrawalConfirmationLabel(profile);
  const canWithdraw = withdrawBlockedReason === null && withdrawConfirmation === confirmationLabel;

  async function handleSaveRole() {
    setSaving(true);
    setRoleSaved(false);
    setRoleError("");
    // 成功時はアクション側の refresh() で画面が最新化される
    const result = await updateUserRole(profile.id, role);
    if (result.error) {
      setRoleError(result.error);
    } else {
      setRoleSaved(true);
    }
    setSaving(false);
  }

  // 選んだ出版社を「追加予定」として並べるだけ。送るのは「アクセス権を更新する」を押したとき
  function markForAdd() {
    const publisher = publishers.find((p) => p.id === selectedPublisherId);
    if (!publisher) return;
    setAccessMessage("");
    setAccessError("");
    setAdded((prev) => [...prev, publisher]);
    setSelectedPublisherId("");
  }

  async function handleSaveAccess() {
    setSavingAccess(true);
    setAccessMessage("");
    setAccessError("");

    // 途中で落ちたら、やり残した分だけを state に残してから知らせる
    // ＝もう一度押せば続きからやり直せる（成功した分を二重に処理しない）= report-edit-form.tsx
    const pendingRemovals = [...removedIds];
    for (const publisherId of removedIds) {
      const result = await revokePublisherAccess(profile.id, publisherId);
      if (result.error) {
        setRemovedIds(pendingRemovals);
        setAccessError(result.error);
        setSavingAccess(false);
        return;
      }
      pendingRemovals.shift();
      setAccess((prev) => prev.filter((a) => a.publisherId !== publisherId));
    }
    setRemovedIds([]);

    const pendingAdds = [...added];
    for (const publisher of added) {
      const result = await grantPublisherAccess(profile.id, publisher.id);
      if (result.error !== undefined) {
        setAdded(pendingAdds);
        setAccessError(result.error);
        setSavingAccess(false);
        return;
      }
      pendingAdds.shift();
      // サーバーが返した行（付与日・付与者を持つ）を一覧に足す
      setAccess((prev) => [...prev, result.access]);
    }
    setAdded([]);

    setAccessMessage("更新しました");
    setSavingAccess(false);
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    setWithdrawError("");
    const result = await withdrawUserAsAdmin(profile.id, withdrawConfirmation);
    if (result.error) {
      setWithdrawError(result.error);
      setWithdrawing(false);
      return;
    }
    // 対象はもうこの画面に用が無い（PII が消えた抜け殻）ので一覧へ戻す
    router.push(routes.admin.users);
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
              disabled={roleBlockedReason !== null}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                role === r.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {roleBlockedReason && <p className="text-sm text-gray-500">{roleBlockedReason}</p>}
        <button
          onClick={handleSaveRole}
          disabled={saving || role === profile.role || roleBlockedReason !== null}
          className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "更新中..." : "ロールを更新"}
        </button>
        {roleError && <p className="text-sm text-red-700">{roleError}</p>}
        {roleSaved && <p className="text-sm text-green-700">更新しました</p>}
      </div>

      {/* 出版社アクセス */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">出版社アクセス権限</h2>

        <p className="text-xs text-gray-500">
          追加・削除はどちらも「アクセス権を更新する」で確定します。
        </p>

        {access.length === 0 && added.length === 0 ? (
          <p className="text-sm text-gray-500">付与された出版社なし</p>
        ) : (
          <ul className="space-y-2">
            {/* ⚠️ 外す印を付けた行を一覧から消さない。消すと「消えた」のか「壊れた」のか
                区別が付かず、押し間違いも戻せない（投稿の画像で実機指摘を受けた形と同じ） */}
            {access.map((a) => (
              <li key={a.publisherId} className="flex items-center justify-between gap-3 text-sm">
                <span className={isRemoved(a.publisherId) ? "text-gray-500 line-through" : "text-gray-800"}>
                  {a.publisher.name}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {isRemoved(a.publisherId) && <span className="text-xs text-gray-500">削除予定</span>}
                  <button
                    onClick={() =>
                      setRemovedIds((prev) =>
                        isRemoved(a.publisherId)
                          ? prev.filter((id) => id !== a.publisherId)
                          : [...prev, a.publisherId]
                      )
                    }
                    className="text-xs text-red-700 hover:text-red-900"
                  >
                    {isRemoved(a.publisherId) ? "外すのをやめる" : "権限を外す"}
                  </button>
                </span>
              </li>
            ))}
            {added.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-800">{p.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-gray-500">追加予定</span>
                  <button
                    onClick={() => setAdded((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-xs text-gray-700 hover:text-gray-900"
                  >
                    やめる
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {ungrantedPublishers.length > 0 && (
          <div className="flex gap-2 pt-2">
            <select
              aria-label="追加する出版社"
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
              onClick={markForAdd}
              disabled={!selectedPublisherId}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              追加
            </button>
          </div>
        )}

        <button
          onClick={handleSaveAccess}
          disabled={savingAccess || !hasAccessChanges}
          className="w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {savingAccess ? "更新中..." : "アクセス権を更新する"}
        </button>
        {accessError && <p className="text-sm text-red-700">{accessError}</p>}
        {accessMessage && <p className="text-sm text-green-700">{accessMessage}</p>}
      </div>

      {/* 代行退会（取り消せない操作なので、他のカードと見た目を分ける） */}
      <div className="bg-white rounded-lg border border-red-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-red-700">このユーザーを退会させる</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            本人の退会と同じ処理を管理者が代行します。ログインできなくなり、メールアドレス・表示名・
            公開リンクが消えます。投稿は「退会済みユーザー」の投稿として残ります。
            <strong className="text-red-700">取り消せません。</strong>
          </p>
        </div>

        {withdrawBlockedReason !== null ? (
          <p className="text-sm text-gray-500">{withdrawBlockedReason}</p>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="withdrawConfirmation" className="block text-xs text-gray-600">
                確認のため <span className="font-medium text-gray-900">{confirmationLabel}</span>{" "}
                と入力してください
              </label>
              <input
                id="withdrawConfirmation"
                type="text"
                value={withdrawConfirmation}
                onChange={(e) => setWithdrawConfirmation(e.target.value)}
                autoComplete="off"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <button
              onClick={handleWithdraw}
              disabled={!canWithdraw || withdrawing}
              className="w-full py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 transition-colors"
            >
              {withdrawing ? "処理中..." : "退会させる"}
            </button>
          </>
        )}
        {withdrawError && <p className="text-sm text-red-700">{withdrawError}</p>}
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
