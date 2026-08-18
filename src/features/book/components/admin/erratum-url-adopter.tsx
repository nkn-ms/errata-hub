"use client";

import { useRef, useState } from "react";
import { adoptReportedErratumUrl } from "@/features/book/actions/book";
import { hostnameOf } from "@/utils/external-url";

/**
 * 投稿者が申告した正誤表 URL を、その本の公式な正誤表として採用する管理者用の操作。
 *
 * 外部リンクは攻撃面（フィッシング等）になるため、読者の申告をそのまま公開せず、
 * 管理者が中身を確認してから公開する（schema.prisma の Book.erratumUrl 参照）。
 *
 * ⚠️ **上書きになるときだけ確認を挟む**（摩擦は「取り消せなさ」に比例させる）。
 *    既存 URL がある場合、採用するとその値は AuditLog にしか残らない＝画面からは戻せない。
 *    逆に未登録の本への採用は、書籍編集からいつでも直せる＝確定ボタンだけで足りる。
 *    `confirm()` は使わない（<dialog> なら ESC とフォーカス管理が付いてくる＝他の確認と同じ作法）。
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
  const confirmRef = useRef<HTMLDialogElement>(null);

  const alreadyAdopted = currentBookErratumUrl === reportedUrl;
  // 既に別の URL が登録されている＝採用するとそれを失う。ここだけが取り消せない操作
  const willOverwrite = currentBookErratumUrl !== null && !alreadyAdopted;

  async function handleAdopt() {
    confirmRef.current?.close();
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

  function handleClick() {
    if (willOverwrite) {
      setError("");
      confirmRef.current?.showModal();
      return;
    }
    void handleAdopt();
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
          onClick={handleClick}
          disabled={saving || saved}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "採用中..." : "この本の正誤表として採用"}
        </button>
      )}

      {willOverwrite && (
        <p className="text-xs text-amber-700">
          ⚠️ この本には既に別の正誤表URL（{hostnameOf(currentBookErratumUrl)}）が登録されています。採用すると上書きされます。
        </p>
      )}

      <dialog
        ref={confirmRef}
        className="m-auto max-h-[90dvh] w-[90vw] max-w-lg rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="space-y-4 rounded-lg bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">正誤表URLを採用しますか？</h2>
          <p className="text-sm text-gray-600">
            この本には既に正誤表URLが登録されています。採用すると
            <strong>上書きされ、元のURLは操作ログにしか残りません。</strong>
          </p>
          {/* 何が何に変わるのかを、押す前にこの場で見せる（ホストだけでは判断できない） */}
          <dl className="space-y-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">現在</dt>
              <dd className="text-gray-800 break-all">{currentBookErratumUrl}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">採用</dt>
              <dd className="text-gray-800 break-all">{reportedUrl}</dd>
            </div>
          </dl>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => confirmRef.current?.close()}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdopt}
              disabled={saving}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "採用中..." : "採用する"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
