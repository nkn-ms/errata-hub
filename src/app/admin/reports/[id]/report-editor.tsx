"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { deleteReport, deleteReportImage, updateReport } from "@/features/report/actions/report";
import { NumberField } from "@/components/ui/number-field";
import { STATUS_LABELS } from "@/features/report/constants/report-status";
import { REPORT_LIMITS } from "@/features/report/constants/report-limits";
import { routes } from "@/constants/routes";
import { toIntOrNull } from "@/utils/parse";
import type { ReportStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";

type Status = ReportStatus;

type Props = {
  id: string;
  currentStatus: Status;
  currentStatusNote: string;
  currentFixedEdition?: number | null;
  currentFixedPrinting?: number | null;
  images: { id: string; imageUrl: string }[];
};

export function AdminReportEditor({ id, currentStatus, currentStatusNote, currentFixedEdition, currentFixedPrinting, images }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(currentStatus);
  const [statusNote, setStatusNote] = useState(currentStatusNote);
  const [fixedEdition, setFixedEdition] = useState<string>(currentFixedEdition?.toString() ?? "");
  const [fixedPrinting, setFixedPrinting] = useState<string>(currentFixedPrinting?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // 画像の削除も「更新する」で確定する（投稿者の編集画面と同じ扱い）。
  // ⚠️ 消す印を付けた画像を**一覧から外さない**。外すと「消えた」のか「壊れた」のか区別が付かず、
  //    全部に印を付けると節ごと消えてしまう（実機で指摘された）。薄く表示して元に戻せるようにする。
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const isRemoved = (imageId: string) => removedIds.includes(imageId);

  // 修正版・刷の入力欄は「修正済み」のときだけ表示する（保存値を消す判断はサーバーが担う）
  const isFixed = status === "FIXED";

  async function handleDelete() {
    if (!confirm("この投稿を削除しますか？この操作は取り消せません。")) return;
    setSaving(true);
    setError("");
    // 成功時はアクション側が一覧へ redirect する
    const result = await deleteReport(id);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
    }
  }

  async function handleSave() {
    // 画像の削除だけは取り消せないので、更新の直前に確かめる（投稿削除と同じ扱い）
    if (
      removedIds.length > 0 &&
      !confirm(`画像${removedIds.length}枚を削除します。取り消せません。よろしいですか？`)
    ) {
      return;
    }

    setSaving(true);
    setSaved(false);
    setError("");

    // 成功時はアクション側の refresh() で画面が最新化される。
    // 修正版・刷を「修正済み」以外で消すルールはサーバー（ReportUpdateSchema）が保証するので、
    // ここは入力値をそのまま送る（未入力は toIntOrNull が null にする）。
    const result = await updateReport(id, {
      status,
      statusNote: statusNote || null,
      fixedEdition: toIntOrNull(fixedEdition),
      fixedPrinting: toIntOrNull(fixedPrinting),
    });
    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // 途中で落ちたら、やり残した分だけを残してから知らせる
    // ＝もう一度「更新する」を押せば続きからやり直せる（成功した分を二重に消さない）
    const pendingRemovals = [...removedIds];
    for (const imageId of removedIds) {
      const deleted = await deleteReportImage(imageId);
      if (deleted.error !== undefined) {
        setRemovedIds(pendingRemovals);
        setError(deleted.error);
        setSaving(false);
        return;
      }
      pendingRemovals.shift();
    }
    // 一覧そのものは持たない: 消えた分は deleteReportImage の refresh() でサーバー側が描き直す
    setRemovedIds([]);

    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">ステータス・対応記録</h2>

      <div role="group" aria-labelledby="status-label">
        <span id="status-label" className="block text-sm font-medium text-gray-700 mb-2">ステータス</span>
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

      {isFixed && (
        <div className="flex gap-4">
          <div>
            <label htmlFor="fixed-edition" className="block text-sm font-medium text-gray-700 mb-1">修正済みの版</label>
            <NumberField
              id="fixed-edition"
              value={fixedEdition}
              onChange={(v) => { setFixedEdition(v); setSaved(false); }}
              placeholder="例: 2"
              className="w-24"
            />
          </div>
          <div>
            <label htmlFor="fixed-printing" className="block text-sm font-medium text-gray-700 mb-1">修正済みの刷</label>
            <NumberField
              id="fixed-printing"
              value={fixedPrinting}
              onChange={(v) => { setFixedPrinting(v); setSaved(false); }}
              placeholder="例: 3"
              className="w-24"
            />
          </div>
        </div>
      )}

      {/* ⚠️ **ここは出版社の回答を書く欄ではない。** 出版社からの回答は公開ページの
          「出版社として回答する」から入れる（代理記載も同じ経路 = actions/publisher-comment.ts）。
          この欄は運営者自身の説明で、ステータスの属性なのでステータスと同じ確定ボタンで保存する */}
      <div>
        <label htmlFor="status-note" className="block text-sm font-medium text-gray-700 mb-1">運営者の補足</label>
        <p className="text-xs text-gray-500 mb-1">
          ステータスに添える運営者からの説明。「その他」を選んだときは必須です。
        </p>
        <textarea
          id="status-note"
          value={statusNote}
          onChange={(e) => { setStatusNote(e.target.value); setSaved(false); }}
          maxLength={REPORT_LIMITS.statusNote}
          rows={3}
          placeholder="例: 出版社が廃業しており連絡が取れません"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* 添付画像。**閲覧だけでなく操作できるものなので、上の投稿内容ではなくこのフォームの中に置く**
          （権利者から「この画像だけ消してほしい」と言われたときに投稿ごと消さずに応えるための手段
          = docs/moderation-policy.md）。1枚も無ければ節ごと出さない */}
      {images.length > 0 && (
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">添付画像</span>
          <div className="flex flex-wrap gap-3">
            {images.map((image) => (
              <div key={image.id} className="relative">
                <a href={image.imageUrl} target="_blank" rel="noopener noreferrer">
                  {/* 自前 Storage 由来だが書影と同じ unoptimized 恒久運用に合わせる */}
                  <Image
                    src={image.imageUrl}
                    alt="添付画像"
                    width={128}
                    height={180}
                    unoptimized
                    className={`w-32 h-auto rounded border border-gray-200 transition-opacity cursor-zoom-in ${
                      isRemoved(image.id) ? "opacity-30" : "hover:opacity-80"
                    }`}
                  />
                </a>
                {isRemoved(image.id) && (
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gray-900/80 py-1 text-center text-xs text-white">
                    削除予定
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRemovedIds((prev) =>
                      isRemoved(image.id)
                        ? prev.filter((id) => id !== image.id)
                        : [...prev, image.id]
                    );
                    setSaved(false);
                  }}
                  aria-label={isRemoved(image.id) ? "この画像の削除をやめる" : "この画像を削除"}
                  className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 cursor-pointer"
                >
                  {isRemoved(image.id) ? "↩" : "×"}
                </button>
              </div>
            ))}
          </div>
          {removedIds.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              画像{removedIds.length}枚を「更新する」で削除します。
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">更新しました</p>}

      <div className="flex gap-3 justify-between">
        <div className="flex gap-3">
          <Button type="button" onClick={handleSave} disabled={saving} className="px-6">
            {saving ? "更新中..." : "更新する"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push(routes.admin.reports)}
            variant="secondary"
            className="px-6"
          >
            一覧に戻る
          </Button>
        </div>
        <Button type="button" onClick={handleDelete} disabled={saving} variant="dangerOutline">
          削除
        </Button>
      </div>
    </div>
  );
}
