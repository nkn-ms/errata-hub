"use client";

import { useState } from "react";
import { adoptReportedErratumUrl } from "@/app/actions/book";
import { hostnameOf } from "@/utils/external-url";

/**
 * 投稿者が申告した正誤表 URL を、その本の公式な正誤表として採用する管理者用の操作。
 *
 * 外部リンクは攻撃面（フィッシング等）になるため、読者の申告をそのまま公開せず、
 * 管理者が中身を確認してから公開する（schema.prisma の Book.erratumUrl 参照）。
 */
export function ErratumUrlAdopter({
  reportId,
  reportedUrl,
  currentBookErratumUrl,
}: {
  reportId: string;
  reportedUrl: string;
  currentBookErratumUrl: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const alreadyAdopted = currentBookErratumUrl === reportedUrl;

  async function handleAdopt() {
    setSaving(true);
    setError("");
    const result = await adoptReportedErratumUrl(reportId);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">投稿者が申告した正誤表URL</h2>

      <p className="text-xs text-gray-500">
        公開ページには出ていません。内容を確認し、正しければ「この本の正誤表として採用」を押すと、
        書籍ページと投稿詳細に公式リンクとして表示されます。
      </p>

      <a
        href={reportedUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block text-sm text-blue-700 hover:underline break-all"
      >
        {reportedUrl}
      </a>
      <p className="text-xs text-gray-400">リンク先ホスト: {hostnameOf(reportedUrl)}</p>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">この本の正誤表として採用しました</p>}

      {alreadyAdopted && !saved ? (
        <p className="text-sm text-gray-500">この URL は既にこの本の正誤表として登録済みです。</p>
      ) : (
        <button
          type="button"
          onClick={handleAdopt}
          disabled={saving || saved}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "採用中..." : "この本の正誤表として採用"}
        </button>
      )}

      {currentBookErratumUrl && !alreadyAdopted && (
        <p className="text-xs text-amber-700">
          ⚠️ この本には既に別の正誤表URL（{hostnameOf(currentBookErratumUrl)}）が登録されています。採用すると上書きされます。
        </p>
      )}
    </div>
  );
}
