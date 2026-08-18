import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "使用技術 | Errata Hub",
  description: "Errata Hub の使用技術と、選定の理由・実装の要点・システム構成の紹介。",
};

// 「何を使っているか」の網羅はこの一覧が持ち、下の REASONS / IMPLEMENTATION は文章だけを書く。
// 一覧と文章を1枚のカードに混ぜると、技術名を拾いたい読み手が本文を読み飛ばせない
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

// 「なぜその形にしたか」だけを書く節。見出しは技術名ではなく判断そのものにする
// （下の IMPLEMENTATION と技術名が並ぶと、同じ見出しが2回出て読み手が対応を取らされる）。
// 選定に判断があったものだけを載せ、4枚を上限にする。増やしたくなったら
// IMPLEMENTATION かリポジトリの docs/ へ回す（面談で聞かれるたびに1枚ずつ増えると、
// この節に付加情報が混ざって「理由」でなくなるため）。
const REASONS = [
  {
    name: "1つの基盤に寄せる（Supabase）",
    why: "認証・データ・画像を別々のサービスに分けると、障害のときに切り分ける対象がその数だけ増える。個人が運用する規模では、個々の最適さよりも構成の単純さを優先し、3つとも Supabase に置いた。",
  },
  {
    name: "画面のためだけの API を作らない",
    why: "画面を作るコード自体がサーバーで動く（サーバーコンポーネント）ため、DB を直接読める。ここに画面用の API を挟むと型の効かない境界と認可の確認点が増えるので、HTTP の受け口（Route Handler）は外部から呼ばれるものに限り、画面のデータ取得はサービス層の関数呼び出しに統一している。",
  },
  {
    name: "型は DB スキーマから生成する（Prisma）",
    why: "Prisma はスキーマ定義から TypeScript の型を生成し、テーブルの定義とコード上の型が一箇所に集約される。TypeScript と PostgreSQL を組み合わせる構成では採用例が多く、実装時に参照できる情報も豊富にあるため。",
  },
  {
    name: "和書の書誌は OpenBD を正とする",
    why: "Google Books は和書のタイトルをローマ字で返すことがあり、出版社が空のものもある。書誌の正確さでは OpenBD が上回るため ISBN 検索の基準とし、OpenBD にほとんど登録がない書影だけを Google Books で補っている。",
  },
] as const;

// 「このアプリでどう組んだか」を書く節。フレームワークを入れれば自動的にそうなること
// （App Router なら画面の材料が1つのフォルダに集まる、Prisma なら型が生成される）は
// 実装ではないので書かない。書くのは、こちらが決めた置き方・分け方だけ。
// 用語の補足は初出の側に置く（サーバーコンポーネントと Route Handler は上の REASONS が初出）。
const IMPLEMENTATION = [
  {
    name: "Next.js 16 (App Router)",
    why: "公開側のページは (site) というルートグループ（URL には現れないフォルダ）にまとめ、ヘッダーと本文の幅をここで一度だけ持たせている。ログイン・登録・退会はこの外に置いてあり、フォルダの位置がそのまま「共通の枠を受け取らない画面」を表している。投稿や管理操作は Server Action（フォームの送信先をサーバー上の関数に直接向ける仕組み）で処理していて、そのための API は作っていない。",
  },
  {
    name: "データアクセス（サーバーコンポーネント + サービス層）",
    why: "ページのデータ取得は、サーバーコンポーネントから src/services/* の関数をそのまま呼んでいる。画面と DB の間に自前の HTTP 層はなく、Route Handler を置いたのは外に口が要る3本だけ（書籍検索が2本と画像アップロードが1本）。",
  },
  {
    name: "Supabase (Auth + Postgres + Storage)",
    why: "GitHub ログインは OAuth 2.0 の認可コードフロー（PKCE / RFC 7636）で動く。利用者を認可 URL へ送り、戻ってきた code をセッションに交換するところまでがアプリの仕事で、client secret と code verifier は Supabase が預かる。メール認証のリンクも、同じように code を交換して有効になる。",
  },
  {
    name: "Prisma v7 (ORM)",
    why: "DB への接続は用途で分けている。アプリからは接続プーラー（DB への接続を何本か開いたままにして、処理に順番に貸し出す中継役）を通す。サーバーレスは処理のたびに立ち上がるので、毎回 DB へ直接つなぐと接続の数が上限に達してしまう。テーブルを作り替えるマイグレーションのときだけは、最初から最後まで同じ接続を保つ必要があってプーラーを通せないので、直結の URL を使っている。",
  },
  {
    name: "OpenBD / Google Books API",
    why: "ISBN で本を引くときは OpenBD、タイトルで探すときと書影が要るときは Google Books を使う。どちらもブラウザからは呼ばず、サーバー側の /api/books/openbd と /api/books/search を通す。API キーを隠すためと、閲覧者の IP を外部サービスへ渡さないため。",
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
    why: "投稿・画像アップロード・書籍検索には、利用者ごとに一定時間あたりの回数制限をかけている。回数の記録に専用のサービスは足さず、すでに使っている PostgreSQL の1テーブルで数える。加算と上限の判定を1つの SQL 文で行うので、同時に複数のリクエストが来ても二重に数えられない。",
  },
  // 認証（本物のセッションか）→ 認可（何をしてよいか）の順に並べる。
  // 別の関心事なので1枚にまとめない。「認可」の語の説明は後者の冒頭に置く。
  {
    name: "セッションは毎回サーバーで検証",
    why: "ログイン状態の確認には Supabase の getUser() だけを使い、getSession() は使っていない。前者は認証サーバーに問い合わせてトークンを検証するが、後者は cookie に入っている値をそのまま信用する。cookie は利用者の手元にあるものなので、そこに書かれた「ログイン済み」を信じるかどうかが、この2つの差になる。",
  },
  {
    name: "認可はサーバー側で判定",
    why: "誰が何をしてよいか（認可）は、管理操作を実行するたびにサーバーでロールを確認して決めている。画面にボタンを出すかどうかは補助でしかなく、権限を保証していない。データベース側でも、ブラウザから直接つなぐ経路は全て拒否している（アプリのサーバーを通らない読み書きを成立させないため）。",
  },
  {
    name: "操作ログ（監査ログ）",
    why: "削除・退会・権限変更のような取り消せない操作は、変更前と変更後の内容を添えて記録している。記録と操作は1つのトランザクションにまとめてあり、どちらか片方だけが残ることはない。",
  },
] as const;

export default function TechPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">使用技術</h1>
        <p className="mt-1 text-sm text-gray-500">
          Errata Hub を構成する技術と、それを選んだ理由、実際の組み方をまとめています。
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

      {/* 選んだ理由 → 実装の要点 の順に置く。読み手が降りる深さを自分で選べるようにするため、
          一覧（何を使うか）→ 理由（なぜその形か）→ 要点（どう組んだか）と段を作っている。 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">選んだ理由</h2>
        <div className="space-y-3">
          {REASONS.map((r) => (
            <div key={r.name} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{r.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{r.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 実装の要点 */}
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
        色や UI 部品の決まりごとは
        <Link href={routes.design} className="mx-1 text-blue-600 hover:underline">
          デザインの決まりごと
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

function Arrow() {
  return <span className="text-gray-400 text-lg leading-none">↓</span>;
}
