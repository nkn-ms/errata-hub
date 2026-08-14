import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";
import type { ReportStatus } from "@/generated/prisma/client";
import { STATUS_LABELS, STATUS_COLORS, STATUS_TOOLTIPS } from "@/constants/report-status";

export const metadata: Metadata = {
  title: "使い方 | Errata Hub",
  description: "Errata Hub の投稿の流れ、種別の使い分け、各ステータスの意味を説明します。",
};

// 投稿の流れ（5ステップ）
const STEPS = [
  {
    title: "出版社の正誤表を確認",
    body: "多くの出版社は公式サイトで正誤表を公開しています。すでに掲載されている誤りは投稿不要です。投稿フォームでは、その本の正誤表が登録済みならリンクを表示します。",
  },
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
    title: "確認して投稿",
    body: "「確認する」で送信内容をそのまま表示します。見直して「投稿する」を押すと一覧に公開され、管理者が確認します。状況はステータスで追えます。",
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

// 投稿のルール（要約。正文は利用規約の「禁止事項」）
// ⚠️ 条番号はここに書かない。規約は条が増えるたびに以降が繰り下がり、この手の参照だけが取り残される
//    （実際に禁止事項は 第7条 → 第8条 → 第9条 と2回ずれ、ここは第7条のまま残っていた）。
const RULES = [
  "批判は内容へ。著者・出版社など人への攻撃（誹謗中傷）は禁止です。",
  "本文の転載は、誤りの指摘に必要な最小限の引用にとどめてください。",
  "事実に基づかない断定、なりすまし、スパム・宣伝は禁止です。",
  "投稿の前に出版社の公式な正誤表を確認してください（掲載済みの誤りは投稿不要です）。",
] as const;

// 出版社からの回答の説明（要約。正文は利用規約の「出版社等による回答」）
const PUBLISHER_ANSWERS = [
  "回答できるのは、運営者から出版社へ連絡した後の投稿だけです。「未対応」の間は投稿者が本文を修正できるため、回答が宙に浮かないようにしています。",
  "回答は投稿の詳細ページに、付いた順にすべて表示されます。一覧やトップには最新の1件だけを出します。",
  "回答は書いた本人も取り消せません。掲載後に消せるのは、ルールに反する場合の運営者による削除だけです。",
  "運営者が出版社に代わって記載した場合は、「運営者が代理で記載」と回答に表示します。",
] as const;

// ステータスは constants/report-status.ts の定義順で列挙する
const STATUS_KEYS = Object.keys(STATUS_LABELS) as ReportStatus[];

export default function HowToUsePage() {
  return (
    <div className="space-y-10">
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
            投稿は運営者と出版社のやり取りに応じて、次のステータスへ移っていきます。
            「未対応」の間は投稿者が内容を修正でき、投稿を取り下げる（削除する）こともできます。出版社へ連絡した後は、内容を変えずに追記と画像の追加ができます。
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

        {/* 出版社からの回答 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">出版社からの回答</h2>
          <p className="text-sm text-gray-500 mb-4">
            出版社の担当者は、自社の書籍への投稿にこのサイトから直接回答できます。
          </p>
          <ul className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            {PUBLISHER_ANSWERS.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-gray-600">
                <span className="shrink-0 text-gray-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 投稿のルールと通報 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">投稿のルールと通報</h2>
          <p className="text-sm text-gray-500 mb-4">
            要約です。正式なルールは
            <Link href={routes.terms} className="text-blue-600 hover:underline">
              利用規約
            </Link>
            をご覧ください。
          </p>
          <ul className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-2 text-sm text-gray-600">
                <span className="shrink-0 text-gray-400">•</span>
                {rule}
              </li>
            ))}
          </ul>
          <div className="mt-3 bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600 space-y-2">
            <p>
              ルールに反する投稿や権利侵害を見つけた方（出版社・著者の方を含む）は、対象投稿の URL を添えて{" "}
              <a href={`mailto:${site.contactEmail}`} className="text-blue-600 hover:underline">
                {site.contactEmail}
              </a>{" "}
              までお知らせください。内容を確認のうえ対応します。
            </p>
            <p>
              なお、「誤りかどうか」に争いがある投稿は、削除ではなく
              <strong>出版社・著者からの回答を併記して公開する</strong>
              方針です。運営者が正誤の審判はしません。
            </p>
            <p>
              <strong>運営者が投稿の内容を書き換えることはありません。</strong>
              ただし、権利侵害・個人情報・誹謗中傷にあたる部分が含まれていた場合に限り、その部分だけを伏せることがあります。
              投稿全体を消さずに済ませるための措置で、伏せた場合は投稿にその旨を表示します。
            </p>
          </div>
        </section>

        {/* 免責 */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            掲載されている投稿は投稿者からの報告であり、<strong>出版社による確認が完了していない情報を含みます。</strong>
          </span>
        </div>
    </div>
  );
}
