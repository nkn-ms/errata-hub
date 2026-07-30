import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { PAGE_CONTAINER } from "@/constants/layout";

export const metadata: Metadata = {
  title: "使用技術 | Errata Hub",
  description: "Errata Hub の使用技術と、それぞれを選んだ理由・システム構成の紹介。",
};

// 使用技術と「なぜ選んだか」
const TECHS = [
  {
    name: "Next.js 16 (App Router)",
    why: "サーバーコンポーネントで DB から直接データを取得でき、データ取得とUIを同じ場所に書ける。ルーティングはファイル構成で表現でき、認証ガードや API Route も同一フレームワークで完結する。",
  },
  {
    name: "TypeScript",
    why: "Prisma の生成型や種別・ステータスの enum を型として扱い、ラベルやマッピングの取りこぼしをコンパイル時に検出する。リファクタの安全網として採用。",
  },
  {
    name: "Tailwind CSS",
    why: "ユーティリティクラスでデザインの一貫性を保ちつつ、コンポーネント単位で素早くスタイリングできる。クラス名の設計コストを抑えられる。",
  },
  {
    name: "Supabase Auth (PKCE)",
    why: "メール確認フローを含む認証をマネージドで利用。OAuth 2.0 の PKCE（RFC 7636）による code フローで、SPA でも安全に認可コードを交換できる。Postgres と認証が同じ基盤に揃う点も決め手。",
  },
  {
    name: "Prisma v7 (ORM)",
    why: "スキーマからの型生成でモデルを型安全に扱える。v7 では接続URLを prisma.config.ts に分離する構成へ移行し、マイグレーション用の直結URLとアプリ用のプーラーURLを使い分けている。",
  },
  {
    name: "Google Books API",
    why: "ISBN を本の同一性の基準とするため、書籍メタデータを外部から取得。APIキーはサーバーサイド（/api/books/search）に隠蔽し、クライアントへ露出させない。",
  },
] as const;

export default function TechPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className={`${PAGE_CONTAINER} py-8 space-y-10`}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">使用技術</h1>
          <p className="mt-1 text-sm text-gray-500">
            Errata Hub を構成する技術と、それぞれを選んだ理由をまとめています。
          </p>
        </div>

        {/* 技術スタック */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">技術スタックと選定理由</h2>
          <div className="space-y-3">
            {TECHS.map((t) => (
              <div key={t.name} className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                <p className="mt-1 text-sm text-gray-600">{t.why}</p>
              </div>
            ))}
          </div>
        </section>

        {/* システム構成 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">システム構成</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col items-center gap-3 text-sm">
              <Box label="ブラウザ" sub="ユーザー" />
              <Arrow />
              <Box label="Vercel" sub="Next.js 16（サーバーコンポーネント / API Route）" highlight />
              <Arrow />
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Box label="Supabase" sub="Auth + Postgres" />
                <Box label="Google Books API" sub="書籍メタデータ" />
              </div>
            </div>
            <p className="mt-6 text-xs text-gray-500 leading-relaxed">
              ブラウザからのリクエストは Vercel 上の Next.js が受け、サーバーコンポーネントや API Route が
              Supabase（認証・データ永続化）と Google Books API（書籍情報）に問い合わせます。
              認証は PKCE の code フロー、外部 API キーはサーバー側に隠蔽しています。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Box({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`w-full sm:w-72 rounded-md border px-4 py-3 text-center ${
        highlight ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-gray-50 text-gray-900"
      }`}
    >
      <div className="font-semibold">{label}</div>
      <div className={`mt-0.5 text-xs ${highlight ? "text-gray-300" : "text-gray-500"}`}>{sub}</div>
    </div>
  );
}

function Arrow() {
  return <span className="text-gray-400 text-lg leading-none">↓</span>;
}
