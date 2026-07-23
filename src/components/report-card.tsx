import Link from "next/link";
import Image from "next/image";
import { BookMarked } from "lucide-react";
import { Report } from "@/types/report";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/report-status";
import { TYPE_LABELS, TYPE_COLORS } from "@/constants/report-labels";
import { routes } from "@/constants/routes";
import { formatRelativeJst } from "@/utils/format";
import { cn } from "@/lib/utils";

export function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {label}
    </span>
  );
}

export function getLocationLabel(report: Report): string {
  if (report.medium === "EBOOK") return `電子書籍 ${report.ebookLocation ?? ""}`;
  if (report.medium === "PAPER") {
    let label = `p.${report.page}`;
    if (report.line) label += ` l.${report.line}`;
    if (report.hasMultiplePages) label += " 他";
    return label;
  }
  return "";
}

export function getErrataLabel(report: Report): string {
  if (report.wrong && report.correct) {
    return `${report.wrong} → ${report.correct}`;
  }
  return report.content ?? "";
}

// 「第2版 第3刷」。紙は版が必須・刷は任意（actions/report.ts の superRefine）、
// 電子書籍は版も刷も持たない（どちらも null）ので空文字になる
function getEditionLabel(report: Report): string {
  const parts = [
    report.edition ? `第${report.edition}版` : null,
    report.printing ? `第${report.printing}刷` : null,
  ].filter((part) => part !== null);
  return parts.join(" ");
}

// 投稿1件のカード表示。トップの新着フィードと、テーブルのモバイル表示（md 未満）で共用する。
// カード全体が投稿詳細へのリンクなので、中の書籍名・投稿者は入れ子リンクにしない。
//
// 一目で「どの本の・どこが・どう間違っているか」を伝えるための優先順位:
//   ①左に書影（本サイトの主対象は書籍。画像に目が先に止まり、同じ本＝同じ表紙で視覚的に結びつく）
//   ②見出しは「誤→正（or 内容）」＝カードの主役。投稿タイトルはノイズになりがちなのでカードでは出さず詳細で見せる
//   ③種別は読者に重要なので色付きで主役。ステータスは「未対応」なら控えめ、進んだら色で示す（動きだけを目立たせる）
export function ReportCard({ report }: { report: Report }) {
  const editionLabel = getEditionLabel(report);
  const locationLabel = getLocationLabel(report);

  return (
    <Link
      href={routes.report(report.id)}
      className="flex gap-3 px-4 py-3 hover:bg-blue-50 transition-colors"
    >
      {/* ① 書影。無い本はプレースホルダ。外部API由来でホスト可変のため unoptimized */}
      {report.coverImage ? (
        <Image
          src={report.coverImage}
          alt=""
          width={48}
          height={64}
          unoptimized
          className="w-12 h-16 rounded object-cover shadow-sm flex-shrink-0 bg-gray-100"
        />
      ) : (
        // 表紙が無い本。空の灰箱だと「読み込み中／画像切れ」に見えるので、本アイコンで「表紙なし」を意図的に示す
        <div
          className="w-12 h-16 rounded bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0"
          aria-hidden
        >
          <BookMarked className="w-5 h-5 text-gray-300" />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        {/* ③ 種別（色付き・主役）＋ステータス（未対応は控えめ、動いたら色）＋賛同 */}
        <div className="flex items-center gap-2">
          {/* 幅に余裕があるカードでは折り返さない（テーブル側は列幅の都合で折り返しを許す） */}
          <Badge
            label={TYPE_LABELS[report.type]}
            className={cn(TYPE_COLORS[report.type], "whitespace-nowrap")}
          />
          {report.status === "PENDING" ? (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {STATUS_LABELS[report.status]}
            </span>
          ) : (
            <Badge
              label={STATUS_LABELS[report.status]}
              className={cn(STATUS_COLORS[report.status] ?? "bg-gray-100 text-gray-700", "whitespace-nowrap")}
            />
          )}
          {report.upvoteCount > 0 && (
            <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">
              👍 {report.upvoteCount}
            </span>
          )}
        </div>

        {/* どの本か・どこか */}
        <div className="text-sm font-medium text-gray-900 truncate">{report.bookTitle}</div>
        {(editionLabel || locationLabel) && (
          <div className="text-xs text-gray-500">
            {[editionLabel, locationLabel].filter(Boolean).join(" ・ ")}
          </div>
        )}

        {/* ② 何が間違っているか＝カードの主役 */}
        <div className="text-sm text-gray-800 line-clamp-2">{getErrataLabel(report)}</div>

        {report.publisherComment && (
          <div className="text-xs text-gray-600 line-clamp-2 border-l-2 border-gray-200 pl-2">
            出版社: {report.publisherComment}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="truncate">{report.userName}</span>
          <span className="flex-shrink-0">{formatRelativeJst(report.createdAtIso)}</span>
        </div>
      </div>
    </Link>
  );
}
