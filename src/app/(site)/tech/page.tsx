import type { Metadata } from "next";
import { site } from "@/constants/site";

export const metadata: Metadata = {
  title: "使用技術 | Errata Hub",
  description: "Errata Hub の使用技術と、それぞれを選んだ理由・システム構成の紹介。",
};

// 「何を使っているか」の網羅はこの一覧が持ち、下の CHOICES は理由だけを書く。
// 一覧と理由を1枚のカードに混ぜると、技術名を拾いたい読み手が理由文を読み飛ばせない
// （＝網羅性を足すたびに文章が増える）。ここに足しても文量は1行しか増えない。
const STACK = [
  { area: "フレームワーク", items: "Next.js 16（App Router）/ React 19" },
  { area: "言語", items: "TypeScript" },
  { area: "スタイリング", items: "Tailwind CSS v4" },
  { area: "認証", items: "Supabase Auth（メール認証・PKCE）/ GitHub ログイン（OAuth 2.0）" },
  { area: "データベース", items: "PostgreSQL（Supabase）/ Prisma v7" },
  { area: "ファイル保存", items: "Supabase Storage" },
  { area: "バリデーション", items: "Zod" },
  { area: "外部 API", items: "OpenBD / Google Books" },
  { area: "テスト", items: "Vitest / Testing Library / Playwright" },
  { area: "CI", items: "GitHub Actions / CodeQL / Dependabot" },
  { area: "ホスティング", items: "Vercel" },
] as const;

// 選定に判断があったものだけを書く。
// 「型安全だから TypeScript」「クラス名の設計コストが下がるから Tailwind」のように
// 誰が書いても同じ文にしかならないものは、上の STACK に技術名だけ置いて理由は書かない。
const CHOICES = [
  {
    name: "Next.js 16 (App Router)",
    why: "ルーティング・レイアウト・メタデータ・Server Action を、画面と同じ場所に規約で置ける。公開側の共通の枠は (site) ルートグループにまとめ、URL を変えずに「枠を共有する範囲」だけを区切っている。",
  },
  {
    name: "データアクセス（サーバーコンポーネント + サービス層）",
    why: "ページのデータ取得はサーバーコンポーネントから src/services/* を直接呼び、画面と DB の間に自前の HTTP 層を挟まない。外部に口が必要なときだけ Route Handler を置いている（書籍検索と画像アップロードの3本のみ）。",
  },
  {
    name: "Supabase (Auth + Postgres + Storage)",
    why: "認証・データ・画像を1つの基盤に寄せ、運用先を増やさない。GitHub ログインは OAuth 2.0 の認可コードフロー（PKCE / RFC 7636）で、認可 URL へ送って code を交換するところはアプリが持ち、client secret と code verifier の保管は Supabase に任せている。メール認証のリンクも同じ形で code を交換する。",
  },
  {
    name: "Prisma v7 (ORM)",
    why: "スキーマからの型生成をリファクタの安全網にする。接続URLは prisma.config.ts に分離し、マイグレーション用の直結URLとアプリ用のプーラーURLを使い分けている。",
  },
  {
    name: "OpenBD / Google Books API",
    why: "書誌データは OpenBD を正とし、ISBN で本を引く。タイトル検索と書影の補完には Google Books を使う。どちらもサーバー経由（/api/books/openbd・/api/books/search）で、API キーは隠蔽し、閲覧者の IP を外部サービスへ渡さない。",
  },
  {
    name: "Vitest / Playwright",
    why: "単体テストで種別・ステータスの分岐やマッピングを、e2e で認可・投稿・管理操作の一連を実ブラウザで検証する。表示の検証（コントラスト比・CSP 違反の有無）も e2e で機械的に測っている。",
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
  // 認証（本物のセッションか）→ 認可（何をしてよいか）の順に並べる。
  // 別の関心事なので1枚にまとめない。
  {
    name: "セッションは毎回サーバーで検証",
    why: "ログイン状態の確認には getUser() だけを使い、getSession() は使っていない。前者は Auth サーバーにトークンを検証させ、後者は cookie に入っている値をそのまま信じる。誰が何をしてよいかの判定（認可）とは別に、そのセッションが本物かの確認（認証）もサーバー側で行っている。",
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

      {/* 技術スタック（一覧）*/}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">技術スタック</h2>
        {/* <table> ではなく <dl> にしている。2列の表はスマホで潰れるが、
            dl なら sm 未満で「領域 → 技術名」を縦に積めるため（内容は対の羅列で表組みは要らない）。 */}
        <dl className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {STACK.map((row) => (
            <div key={row.area} className="px-4 py-3 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-4">
              <dt className="text-sm font-semibold text-gray-900">{row.area}</dt>
              <dd className="mt-0.5 text-sm text-gray-600 sm:mt-0">{row.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 選んだ理由 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">選んだ理由</h2>
        <div className="space-y-3">
          {CHOICES.map((c) => (
            <div key={c.name} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{c.why}</p>
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
