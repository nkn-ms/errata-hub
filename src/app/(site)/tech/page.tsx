import type { Metadata } from "next";
import { site } from "@/constants/site";

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
    name: "OpenBD / Google Books API",
    why: "書誌データは OpenBD を正とし、ISBN で本を引く。タイトル検索と書影の補完には Google Books を使う。どちらもサーバー経由（/api/books/openbd・/api/books/search）で、API キーは隠蔽し、閲覧者の IP を外部サービスへ渡さない。",
  },
  {
    name: "Vitest / Playwright",
    why: "単体テストで種別・ステータスの分岐やマッピングを、e2e で認可・投稿・管理操作の一連を実ブラウザで検証する。表示の検証（コントラスト比・CSP 違反の有無）も e2e で機械的に測っている。",
  },
  {
    name: "GitHub Actions / CodeQL / Dependabot",
    why: "lint・型チェック・テスト・ビルドを push ごとに実行し、main への直接の変更を塞いでいる。CodeQL が脆弱性を、Dependabot が依存の更新を継続的に見る。",
  },
] as const;

// セキュリティ・運用面の実装（技術スタックとは別立てにする）
const PRACTICES = [
  {
    name: "CSP（nonce + strict-dynamic）",
    why: "リクエストごとに nonce を発行し、script-src に 'unsafe-inline' を置かない。全ページが動的レンダリングになる代償と引き換えに、注入されたスクリプトが動かない状態を保っている。",
  },
  {
    name: "レート制限（Postgres）",
    why: "投稿・画像アップロード・書籍検索に、ユーザー単位の固定ウィンドウ制限をかけている。カウンタは専用のミドルウェアを増やさず Postgres に置き、1文で原子的に数える。",
  },
  {
    name: "認可はサーバー側で判定",
    why: "管理操作は実行のたびにサーバーでロールを確認する。画面の出し分けは補助であって、権限の保証はしていない。DB 側は公開経路を全拒否で塞いでいる。",
  },
  {
    name: "操作ログ（監査ログ）",
    why: "削除・退会・権限変更といった取り消せない操作は、変更前後の内容とあわせて記録する。記録と操作は1つのトランザクションで束ね、片方だけが残らないようにしている。",
  },
] as const;

export default function TechPage() {
  return (
    <div className="space-y-10">
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

        {/* セキュリティ・運用 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">セキュリティと運用</h2>
          <div className="space-y-3">
            {PRACTICES.map((p) => (
              <div key={p.name} className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                <p className="mt-1 text-sm text-gray-600">{p.why}</p>
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
                <Box label="Supabase" sub="Auth + Postgres + Storage" />
                <Box label="OpenBD / Google Books" sub="書誌データ・書影" />
              </div>
            </div>
            <p className="mt-6 text-xs text-gray-500 leading-relaxed">
              ブラウザからのリクエストは Vercel 上の Next.js が受け、サーバーコンポーネントや Server Action が
              Supabase（認証・データ永続化・画像の保存）と書誌 API に問い合わせます。
              認証は PKCE の code フロー、外部 API キーはサーバー側に隠蔽しています。
              書誌 API へはブラウザから直接アクセスせず、サーバーが代理で取得します（閲覧者の IP を外部へ渡さないため）。
            </p>
          </div>
        </section>

        {/* ⚠️ この節がこのページの役割の線引き。設計判断の詳細（何を選び何を捨てたか）は
            README とリポジトリの docs/ に置き、このページでは繰り返さない。
            2か所に同じ説明を持つと、実装を変えたときに片方だけ古くなる。 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          それぞれの選定でどんな代償を受け入れたか、なぜ採らなかった選択肢があるかは、
          リポジトリの README と設計ドキュメントに書いています。
          <a
            href={site.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-blue-600 hover:underline"
          >
            GitHub でソースを見る
          </a>
        </div>
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
