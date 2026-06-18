import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/constants/routes";
import type { ReportStatus } from "@/generated/prisma/client";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TOOLTIPS } from "@/constants/report-status";

export const metadata: Metadata = {
  title: "使い方 | Errata Hub",
  description: "Errata Hub の投稿の流れ、種別の使い分け、各ステータスの意味を説明します。",
};

// 投稿の流れ（4ステップ）
const STEPS = [
  {
    title: "書籍を検索",
    body: "投稿フォームの書籍検索から、対象の本を ISBN 付きで選びます。版・刷がわかる場合は補足できます。",
  },
  {
    title: "種別を選ぶ",
    body: "「正誤情報」「改善提案」「その他」から、報告したい内容に合うものを選びます。",
  },
  {
    title: "内容を入力",
    body: "誤りの位置（ページ・行や Kindle 位置）と、正誤情報なら「誤 → 正」、それ以外は内容・提案を記入します。",
  },
  {
    title: "投稿",
    body: "投稿すると一覧に公開され、管理者が確認します。状況はステータスで追えます。",
  },
] as const;

// 種別の使い分け
const TYPES = [
  {
    name: "正誤情報",
    desc: "誤字脱字・事実誤り・コード誤りなど、客観的に「誤り」と言える箇所の報告。「誤」と「正」をセットで記入します。",
  },
  {
    name: "改善提案",
    desc: "誤りとは言えないが「読みにくい・わかりにくい」など、より良い表現への主観的な提案。",
  },
  {
    name: "その他",
    desc: "上のどちらにも当てはまらない報告・連絡。",
  },
] as const;

// ステータスは constants/report-status.ts の定義順で列挙する
const STATUS_KEYS = Object.keys(STATUS_LABELS) as ReportStatus[];

export default function HowToUsePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href={routes.home} className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors">
            Errata Hub
          </Link>
          <Link
            href={routes.submit}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
          >
            投稿する
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">使い方</h1>
          <p className="mt-1 text-sm text-gray-500">
            Errata Hub は、技術書の正誤情報や改善提案を読者どうしで共有する公開掲示板です。
          </p>
        </div>

        {/* 投稿の流れ */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">投稿の流れ</h2>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 bg-white rounded-lg border border-gray-200 p-4"
              >
                <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 種別の使い分け */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">種別の使い分け</h2>
          <div className="space-y-3">
            {TYPES.map((t) => (
              <div key={t.name} className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                <p className="mt-0.5 text-sm text-gray-600">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ステータスの意味 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ステータスの意味</h2>
          <p className="text-sm text-gray-500 mb-4">
            投稿は管理者・出版社のやり取りに応じて、次のステータスへ移っていきます。
          </p>
          <ul className="space-y-2">
            {STATUS_KEYS.map((key) => (
              <li
                key={key}
                className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 bg-white rounded-lg border border-gray-200 p-4"
              >
                <span
                  className={`shrink-0 inline-flex w-fit rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_COLORS[key]}`}
                >
                  {STATUS_LABELS[key]}
                </span>
                <span className="text-sm text-gray-600">{STATUS_TOOLTIPS[key]}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 免責 */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されている投稿は投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>
      </main>
    </div>
  );
}
