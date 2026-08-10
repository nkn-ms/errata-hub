import { cache } from "react";
import type { Metadata } from "next";
import { findReportById } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { TYPE_LABELS, TYPE_COLORS, UPVOTE_HINTS } from "@/constants/report-labels";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { routes } from "@/constants/routes";
import { hostnameOf, isInsecureUrl } from "@/utils/external-url";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { UpvoteButton, type ViewerRole } from "@/components/upvote-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusBadge } from "@/components/status-badge";
import { BookCover } from "@/components/book-cover";
import { ReportAddenda } from "@/components/report-addenda";
import { formatJstDateTime } from "@/utils/format";

type Props = {
  params: Promise<{ id: string }>;
};

function getViewerRole(viewerId: string | undefined, authorId: string): ViewerRole {
  if (!viewerId) return "guest";
  return viewerId === authorId ? "owner" : "user";
}

// generateMetadata と本体で同じ ID を引くため、リクエスト内で1回に重複排除する
const getReport = cache(findReportById);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const raw = await getReport(id);
  if (!raw) return { title: "投稿が見つかりません | Errata Hub" };

  const report = mapReport(raw);
  return {
    title: `${report.title} | Errata Hub`,
    description: `${report.bookTitle} への${TYPE_LABELS[report.type]}の投稿。`,
  };
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;

  const raw = await getReport(id);

  if (!raw) notFound();

  const report = mapReport(raw);

  // 賛同ボタンの初期状態: 閲覧者の立場（未ログイン/投稿者本人/他ユーザー）と賛同済みか
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const viewer = getViewerRole(user?.id, report.userId);
  // 投稿本体の画像（追記に添えて足されたものは、その追記の中に出す）
  const bodyImages = raw.images.filter((image) => image.addendumId === null);
  const upvoted = user
    ? (await prisma.upvote.findUnique({
        where: { reportId_profileId: { reportId: report.id, profileId: user.id } },
        select: { id: true },
      })) !== null
    : false;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: report.bookTitle, href: routes.book(report.isbn) },
          { label: report.title },
        ]}
      />
      {/* 免責バナー */}
      <div className="mb-6 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <span className="mt-0.5 shrink-0">⚠️</span>
        <span>
          この投稿は投稿者からの報告です。<strong>出版社による確認が完了していない情報を含みます。</strong>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* タイトルとバッジ */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[report.type]}`}>
                {TYPE_LABELS[report.type]}
              </span>
              <StatusBadge status={report.status} />
            </div>
            {/* 連絡後は出さない（代わりに本文の下へ追記の欄が出る） */}
            {viewer === "owner" && report.status === "PENDING" && (
              <Link
                href={routes.reportEdit(report.id)}
                className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                投稿を編集する
              </Link>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {report.isWithdrawn ? (
              <span className="text-gray-400">{report.userName}</span>
            ) : (
              <Link href={routes.user(report.userId)} className="hover:underline">
                {report.userName} <span className="text-gray-400">@{report.userIdShort}</span>
              </Link>
            )}
            {/* <p> の中なので div ではなく span を block にする */}
            <span className="block tabular-nums">
              投稿日時: {formatJstDateTime(new Date(report.createdAtIso))}
            </span>
            <span className="block tabular-nums">
              編集日時: {report.editedAtIso ? formatJstDateTime(new Date(report.editedAtIso)) : "-"}
            </span>
          </p>
        </div>

        {/* 書籍情報 */}
        <div className="flex gap-4 p-4 bg-gray-50 rounded-md">
          <BookCover src={report.coverImage} alt={report.bookTitle} width={64} height={90} className="w-16 shrink-0" />
          <div>
            <Link href={routes.book(report.isbn)} className="font-medium text-blue-700 hover:underline">
              {report.bookTitle}
            </Link>
            {report.bookAuthor && <p className="text-sm text-gray-600 mt-0.5">{report.bookAuthor}</p>}
            {report.publisher && <p className="text-sm text-gray-500">{report.publisher}</p>}
            {report.isbn && (
              <p className="text-xs text-gray-400 mt-1">
                ISBN: <span className="font-mono">{report.isbn}</span>
              </p>
            )}
            {raw.book.erratumUrl && (
              <div className="mt-2">
                <a
                  href={raw.book.erratumUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sm text-blue-700 hover:underline"
                >
                  出版社の正誤表を見る（{hostnameOf(raw.book.erratumUrl)}）→
                </a>
                {isInsecureUrl(raw.book.erratumUrl) && (
                  <span className="ml-2 text-xs text-gray-500">保護されていない接続（http://）</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 版・刷・位置情報。数字を等幅にする理由は report-card.tsx の ErrataSummary のコメント参照 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm tabular-nums">
          {(report.edition || report.printing) && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">版・刷</p>
              <p className="text-gray-800">
                {report.edition && `第${report.edition}版`}
                {report.edition && report.printing && " "}
                {report.printing && `第${report.printing}刷`}
              </p>
            </div>
          )}
          {report.medium === "PAPER" && report.page && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">位置</p>
              <p className="text-gray-800">
                p.{report.page}
                {report.line && ` l.${report.line}`}
                {report.hasMultiplePages && " 他"}
              </p>
            </div>
          )}
          {report.medium === "EBOOK" && report.ebookLocation && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">位置（電子書籍）</p>
              <p className="text-gray-800">{report.ebookLocation}</p>
            </div>
          )}
          {report.locationNote && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-0.5">補足</p>
              <p className="text-gray-800">{report.locationNote}</p>
            </div>
          )}
        </div>

        {/* 誤り → 正しい表記 */}
        {(report.wrong || report.correct) && (
          <div>
            <p className="text-xs text-gray-500 mb-2">正誤情報</p>
            <div className="flex items-center gap-3">
              {/* 色は枠と小さいラベル（誤/正）だけに担わせ、内容は通常の文字色にする。
                  地・文字・枠を全部塗ると色が重なって読みにくいため（特にダーク）。
                  ラベルは 700＝淡い地の上でも AA を満たす値 */}
              {report.wrong && (
                <div className="flex-1 rounded-md border border-red-300 px-3 py-2 text-sm text-gray-800 tabular-nums">
                  <p className="text-xs text-red-700 mb-1">誤</p>
                  {report.wrong}
                </div>
              )}
              {report.wrong && report.correct && (
                <span className="text-gray-400 text-lg">→</span>
              )}
              {report.correct && (
                <div className="flex-1 rounded-md border border-green-300 px-3 py-2 text-sm text-gray-800 tabular-nums">
                  <p className="text-xs text-green-700 mb-1">正</p>
                  {report.correct}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 内容 */}
        {report.content && (
          <div>
            <p className="text-xs text-gray-500 mb-1">詳細内容</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.content}</p>
          </div>
        )}

        {/* 備考は投稿の一部なので、事後の追記より上に置く */}
        {report.note && (
          <div>
            <p className="text-xs text-gray-500 mb-1">備考</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.note}</p>
          </div>
        )}

        {/* 本文の直下に置く。連絡後は本文を直せず訂正もここに書かれるので、
            「元の指摘 → 訂正」が1画面で読める並びにする */}
        <ReportAddenda
          reportId={report.id}
          initialAddenda={report.addenda}
          canAdd={viewer === "owner" && report.status !== "PENDING"}
          // 上限は投稿単位（本体＋追記の合計）。残りの計算は部品側で行う
          // （追記で足した分をその場で数に入れるため）
          bodyImageCount={bodyImages.length}
        />

        {/* 画像は閲覧のみ。本人の追加・削除は編集画面（PENDING の間）に置いてある。
            ⚠️ 追記に添えて足された画像はここに混ぜない（上の追記の中に出る）。
               混ぜると、出版社が見た時点で何があったのかが読めなくなる */}
        {bodyImages.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">証拠画像</p>
            <div className="flex flex-wrap gap-3">
              {bodyImages.map((img) => (
                <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                  <Image
                    src={img.imageUrl}
                    alt="証拠画像"
                    width={128}
                    height={180}
                    unoptimized
                    className="w-32 h-auto rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 修正済み情報 */}
        {report.status === "FIXED" && (report.fixedEdition || report.fixedPrinting) && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            ✅ {report.fixedEdition && `第${report.fixedEdition}版`}
            {report.fixedEdition && report.fixedPrinting && " "}
            {report.fixedPrinting && `第${report.fixedPrinting}刷`}
            より修正されました
          </div>
        )}

        {/* 賛同 */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <UpvoteButton
            reportId={report.id}
            initialCount={report.upvoteCount}
            initialUpvoted={upvoted}
            viewer={viewer}
            type={report.type}
          />
          <span className="text-xs text-gray-500">{UPVOTE_HINTS[report.type]}</span>
        </div>

        {/* 出版社コメント */}
        {report.publisherComment && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3">
            <p className="text-xs text-blue-600 mb-1 font-medium">出版社コメント</p>
            <p className="text-sm text-blue-900 whitespace-pre-wrap">{report.publisherComment}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link href={routes.home} className="text-sm text-gray-500 hover:text-gray-700">← 一覧へ戻る</Link>
        <div className="flex items-center gap-3">
          <Link href={routes.book(report.isbn)} className="text-sm text-blue-600 hover:underline">
            この本の投稿一覧
          </Link>
          <Link
            href={routes.submitForBook(report.isbn)}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
          >
            この本に投稿する
          </Link>
        </div>
      </div>
      </>
  );
}
