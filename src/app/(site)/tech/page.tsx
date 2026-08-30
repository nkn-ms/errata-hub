import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "使用技術 | Errata Hub",
  description: "Errata Hub の使用技術と、実装の要点・システム構成の紹介。",
};

// 「何を使っているか」の網羅はこの一覧が持ち、下の IMPLEMENTATION は文章だけを書く。
// 一覧と文章を1枚のカードに混ぜると、技術名を拾いたい読み手が本文を読み飛ばせない
// （＝網羅性を足すたびに文章が増える）。ここに足しても文量は1行しか増えない。
const STACK = [
  { area: "フレームワーク", items: "Next.js 16（App Router）/ React 19" },
  { area: "言語", items: "TypeScript" },
  { area: "スタイリング", items: "Tailwind CSS v4" },
  { area: "認証", items: "Supabase Auth（メール認証・PKCE）/ ソーシャルログイン（Google・GitHub）" },
  { area: "データベース", items: "PostgreSQL（Supabase）/ Prisma v7" },
  { area: "ファイル保存", items: "Supabase Storage" },
  { area: "バリデーション", items: "Zod" },
  { area: "外部 API", items: "OpenBD / Google Books" },
  { area: "テスト", items: "Vitest / Testing Library / Playwright" },
  { area: "CI", items: "GitHub Actions / CodeQL / Dependabot" },
  { area: "ホスティング", items: "Vercel" },
] as const;

// 「このアプリでどう組んだか」を書く節。フレームワークを入れれば自動的にそうなること
// （App Router なら画面の材料が1つのフォルダに集まる、Prisma なら型が生成される）は
// 実装ではないので書かない。書くのは、こちらが決めた置き方・分け方だけ。
const IMPLEMENTATION = [
  {
    name: "データアクセス（サーバーコンポーネント + サービス層）",
    why: "画面を作るコード自体がサーバーで動く（サーバーコンポーネント）ので、ページのデータ取得は src/features/*/service.ts の関数（Prisma で DB を読む層）をそのまま呼んでいる。画面と DB の間に自前の HTTP 層はなく、HTTP の受け口（Route Handler）を置いたのは外に口が要る4本だけ（書籍検索が2本、画像アップロードと認証コールバックが1本ずつ）。",
  },
  {
    name: "Prisma v7 (ORM)",
    why: "DB への接続は用途で分けている。アプリからは接続プーラー（DB への接続を何本か開いたままにして、処理に順番に貸し出す中継役）を通す。サーバーレスは処理のたびに立ち上がるので、毎回 DB へ直接つなぐと接続の数が上限に達してしまう。テーブルを作り替えるマイグレーションのときだけは、最初から最後まで同じ接続を保つ必要があってプーラーを通せないので、直結の URL を使っている。",
  },
  {
    name: "OpenBD / Google Books API",
    why: "ISBN で本を引くときは OpenBD、タイトルで探すときと書影（サムネイル）が要るときは Google Books を使う。どちらもブラウザからは呼ばず、サーバー側の /api/books/openbd と /api/books/search を通す。Google Books の API キーをブラウザに置かないためと、閲覧者の IP を外部サービスへ渡さないため。",
  },
  {
    name: "Vitest / Playwright",
    why: "種別やステータスの分岐は単体テストで押さえ、ログイン・投稿・管理操作の一連は実ブラウザで通している。文字のコントラスト比や CSP 違反の有無も e2e で測っていて、見た目の性質を目視に任せていない。",
  },
] as const;

// セキュリティ・運用面の実装（技術スタックとは別立てにする）。
// 書き方は IMPLEMENTATION と同じ＝事実の説明なので、文末は言い切る（理由句で閉じない）。
const PRACTICES = [
  {
    name: "CSP（nonce + strict-dynamic）",
    why: "ページを返すたびに1回限りの識別子（nonce）を発行し、その識別子が付いたスクリプトだけをブラウザに実行させる。外部から差し込まれたスクリプトは識別子を持たないため、HTML に混ざっても実行されない。引き換えに、ページを事前に生成して配信することはできない（識別子がリクエストごとに変わるため）。",
  },
  {
    name: "レート制限（Postgres）",
    why: "投稿・追記・画像アップロード・書籍検索・出版社の回答・賛同には、利用者ごとに一定時間あたりの回数制限をかけている。回数の記録に専用のサービスは足さず、すでに使っている PostgreSQL の1テーブルで数える。加算と上限の判定を1つの SQL 文で行うので、同時に複数のリクエストが来ても二重に数えられない。",
  },
  {
    name: "認可はサーバー側で判定",
    why: "誰が何をしてよいか（認可）は、管理操作を実行するたびにサーバーでロールを確認して決めている。画面にボタンを出すかどうかは補助でしかなく、権限を保証していない。データベース側でも、ブラウザから直接つなぐ経路は全て拒否している（アプリのサーバーを通らない読み書きを成立させないため）。",
  },
  {
    name: "操作ログ（監査ログ）",
    why: "投稿・アカウント・権限への変更は、削除や退会のような取り消せないものだけでなく、更新も含めて記録している。変更前と変更後の内容を添えるので、誰が何をどう変えたかを後から辿れる。記録と操作は1つのトランザクションにまとめてあり、どちらか片方だけが残ることはない。",
  },
] as const;

// データモデルの簡略図。座標は viewBox（760x290）の中の値で、箱は 150x56 で統一している。
//
// ⚠️ 自動生成の docs/erd.svg（全11モデル・全カラム・359KB）はここに載せない。縮めると読めず、
//    生成は `npx prisma generate` を手で回す運用なので、公開ページに置くとスキーマを変えた日に
//    古い設計を主張することになる。ここは「投稿が何に紐づくか」だけを描き、正は
//    prisma/schema.prisma に置いて、そこへのリンクで受ける。
//
// 省いたのは ReportImage / Upvote / AuditLog / RateLimit の4つ。前2つは投稿にぶら下がるだけ、
// 後2つはアプリのデータではなく運用のためのテーブルなので、関連の形を見るのに要らない。
const ERD_BOX = { w: 150, h: 56 } as const;

const ERD_ENTITIES: { x: number; y: number; label: string; model: string; highlight?: boolean }[] = [
  { x: 20, y: 24, label: "出版社", model: "Publisher" },
  { x: 210, y: 24, label: "書籍", model: "Book" },
  // 中心を塗るのは、この図で言いたいことが「投稿が何に紐づくか」だから
  // （システム構成図で Vercel を塗っているのと同じ扱い）。
  { x: 400, y: 24, label: "投稿", model: "Report", highlight: true },
  { x: 590, y: 24, label: "利用者", model: "Profile" },
  { x: 20, y: 210, label: "出版社の回答", model: "PublisherComment" },
  { x: 590, y: 210, label: "追記", model: "ReportAddendum" },
];

// 矢印は 1:N（矢の先が「多」側）。線は箱の縁で止め、先端は marker が描く。
// 折れ線の縦棒は箱を避けた x に置いてあるので、座標を動かすときは線の交差を目で確かめること。
const ERD_RELATIONS: { d: string; labelX: number; labelY: number; anchor?: "start" }[] = [
  { d: "M170,52 H210", labelX: 190, labelY: 44 },
  { d: "M360,52 H400", labelX: 380, labelY: 44 },
  { d: "M590,52 H550", labelX: 570, labelY: 44 },
  { d: "M95,80 V210", labelX: 104, labelY: 150, anchor: "start" },
  { d: "M440,80 V238 H170", labelX: 305, labelY: 230 },
  { d: "M520,80 V238 H590", labelX: 555, labelY: 230 },
];

export default function TechPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">使用技術</h1>
        <p className="mt-1 text-sm text-gray-500">
          Errata Hub を構成する技術と、実際の組み方をまとめています。
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

      {/* 一覧（何を使うか）→ 要点（どう組んだか）の順に置く。
          読み手が降りる深さを自分で選べるようにするため。 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">実装の要点</h2>
        <div className="space-y-3">
          {IMPLEMENTATION.map((i) => (
            <div key={i.name} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{i.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{i.why}</p>
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
            <Box label="Vercel" sub="Next.js 16（サーバーコンポーネント / Route Handler）" highlight />
            <Arrow />
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Box label="Supabase" sub="Auth + Postgres + Storage" />
              <Box label="OpenBD / Google Books" sub="書誌データ・書影" />
            </div>
          </div>
          <p className="mt-6 text-xs text-gray-500 leading-relaxed">
            {/* 改行は JSX が半角スペースに畳むので、全角の括弧や読点の直前では折らない */}
            ブラウザからのリクエストは Vercel 上の Next.js が受け、サーバーコンポーネントや Server Action（フォームの送信先をサーバー上の関数に直接向ける仕組み）が
            Supabase（認証・データ永続化・画像の保存）と書誌 API に問い合わせます。
            認証は PKCE の code フロー、外部 API キーはサーバー側に隠蔽しています。
            書誌 API へはブラウザから直接アクセスせず、サーバーが代理で取得します（閲覧者の IP を外部へ渡さないため）。
          </p>
        </div>
      </section>

      {/* データモデル */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">データモデル</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* 図は縮めず、入らない幅では横にスクロールさせる。全体を w-full で縮めると
              スマホで文字が 6px 相当になって読めなくなるため（ページ自体は横に溢れない）。 */}
          <div className="overflow-x-auto">
            <ErdDiagram />
          </div>
          {/* 入りきらない幅では図が切れるので、スクロールできることを言葉で示す
              （切れた端だけでは操作できると分からない）。sm 以上は 760px が収まるので出さない。 */}
          <p className="mt-2 text-xs text-gray-500 sm:hidden">図は横にスクロールできます。</p>
          <p className="mt-6 text-xs text-gray-500 leading-relaxed">
            {/* 改行は JSX が半角スペースに畳むので、全角の括弧や読点の直前では折らない */}
            主要な6つのテーブルだけを描いています。矢印は1対多の関連で、矢の先が「多」側です。
            投稿は利用者と書籍のどちらにも必ず紐づき（どちらも必須の参照）、書籍には出版社が任意で付きます。
            出版社の回答が投稿と出版社の両方を参照しているのは、書籍の出版社を管理者が後から直せるためです。
            書籍から辿る形にすると、過去の発言の帰属が後から変わってしまいます。
            追記と回答はどちらも作った時点で不変で、2回目が1回目を書き換えることはありません。
          </p>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            画像・賛同・操作ログ・レート制限のテーブルは、関連の形を見るのに要らないので省きました。
            全11テーブルの図（自動生成）と、型・制約・その判断をした理由はリポジトリにあります。
            <a
              href={`${site.repoUrl}/blob/main/prisma/schema.prisma`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:underline"
            >
              schema.prisma
            </a>
            <a
              href={`${site.repoUrl}/blob/main/docs/erd.svg`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:underline"
            >
              ER 図（全テーブル）
            </a>
          </p>
        </div>
      </section>

      {/* ⚠️ この節がこのページの役割の線引き。設計判断の詳細（何を選び何を捨てたか）は
          README とリポジトリの docs/ に置き、このページでは繰り返さない。
          2か所に同じ説明を持つと、実装を変えたときに片方だけ古くなる。 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        それぞれの選定でどんな代償を受け入れたか、なぜ採らなかった選択肢があるかは、
        リポジトリの README と設計ドキュメントに書いています。
        色や UI 部品の決まりごとは
        <Link href={routes.design} className="mx-1 text-blue-600 hover:underline">
          デザインシステム
        </Link>
        にまとめています。
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

// 色は Tailwind のクラス（fill-* / stroke-*）で当てる。これらはテーマ変数を経由するので、
// ダークモードでも globals.css の変数の差し替えだけで一緒に反転する（style で var() を直に
// 書くとその段が使われていない場合に解決できない）。
function ErdDiagram() {
  return (
    <svg
      viewBox="0 0 760 290"
      className="w-[760px] max-w-none"
      role="img"
      aria-label="データモデルの関連図。投稿を中心に、利用者・書籍・出版社・出版社の回答・追記が紐づく。関連の内容は図の下に文章で書いています。"
    >
      <defs>
        <marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" className="fill-gray-400" />
        </marker>
      </defs>

      {ERD_RELATIONS.map((r) => (
        <g key={r.d}>
          <path
            d={r.d}
            fill="none"
            className="stroke-gray-400"
            strokeWidth="1.5"
            markerEnd="url(#erd-arrow)"
          />
          <text
            x={r.labelX}
            y={r.labelY}
            textAnchor={r.anchor ?? "middle"}
            fontSize="10"
            className="fill-gray-500"
          >
            1:N
          </text>
        </g>
      ))}

      {ERD_ENTITIES.map((e) => (
        <g key={e.model} data-erd-entity>
          <rect
            x={e.x}
            y={e.y}
            width={ERD_BOX.w}
            height={ERD_BOX.h}
            rx="6"
            className={e.highlight ? "fill-gray-900 stroke-gray-900" : "fill-gray-50 stroke-gray-300"}
          />
          <text
            x={e.x + ERD_BOX.w / 2}
            y={e.y + 24}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            className={e.highlight ? "fill-white" : "fill-gray-900"}
          >
            {e.label}
          </text>
          <text
            x={e.x + ERD_BOX.w / 2}
            y={e.y + 42}
            textAnchor="middle"
            fontSize="11"
            className={e.highlight ? "fill-gray-300" : "fill-gray-500"}
          >
            {e.model}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Arrow() {
  return <span className="text-gray-400 text-lg leading-none">↓</span>;
}
