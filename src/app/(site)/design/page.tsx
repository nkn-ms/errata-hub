import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StatusBadge } from "@/features/report/components/report-status-badge";
import { ReportCard } from "@/features/report/components/report-card";
import { ReportTable } from "@/features/report/components/report-table";
import { UpvoteButton } from "@/features/report/components/report-upvote-button";
import { STATUS_LABELS } from "@/features/report/constants/report-status";
import type { ReportStatus } from "@/features/report/types";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";
import { SAMPLE_REPORT, SAMPLE_REPORTS } from "./fixtures";
import {
  CharCounterDemo,
  ErrorPanelDemo,
  MenuPanelDemo,
  NumberFieldDemo,
  SelectFieldDemo,
} from "./demos";

export const metadata: Metadata = {
  title: "デザインシステム",
  description: "Errata Hub の色・文字・UI 部品と、その値をそう決めた理由。",
};

// グレーの梯子。値は CSS 変数を直に読むので、globals.css を変えればこのページも一緒に変わる
// （数値を書き写さない = 説明が実装に追いつかなくなる経路を作らない）。
//
// ⚠️ 色つきの段はここに並べない。Tailwind v4 は**使われている色の変数しか出力しない**ので、
//    使っていない段が空白の四角になって「壊れている」ように見える。
//    代わりに下の「意味を持つ色」で、実際に当てている組み合わせをそのまま見せる。
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const GRAY_ROLES: Partial<Record<(typeof SHADES)[number], string>> = {
  50: "ページ背景",
  200: "枠線",
  400: "補助文字",
  700: "本文",
  900: "見出し・主ボタンの地",
};

// 意味を持つ色。クラス名は静的に書く（Tailwind は組み立てた文字列を読めないため）。
const SEMANTIC_COLORS: { use: string; className: string; sample: string }[] = [
  { use: "誤り・修正なし", className: "bg-red-100 text-red-700", sample: "修正なし" },
  { use: "正しい内容・掲載済み", className: "bg-green-100 text-green-800", sample: "正誤表に掲載" },
  { use: "連絡済み・情報", className: "bg-blue-100 text-blue-700", sample: "出版社へ連絡済み" },
  { use: "修正予定", className: "bg-yellow-100 text-yellow-700", sample: "修正予定" },
  { use: "種別：正誤情報", className: "bg-purple-100 text-purple-700", sample: "正誤情報" },
  { use: "種別：改善提案", className: "bg-cyan-100 text-cyan-700", sample: "改善提案" },
  { use: "注意書き", className: "bg-amber-50 text-amber-900", sample: "この本には正誤表があります" },
  { use: "未対応・既定", className: "bg-gray-100 text-gray-700", sample: "未対応" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

function Item({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
      <p className="mt-1 text-sm text-gray-600">{note}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs items={[{ label: "デザインシステム" }]} />

      <h1 className="text-2xl font-bold text-gray-900">デザインシステム</h1>
      <p className="mt-2 text-sm text-gray-600">
        このサイトで使っている色・文字・UI 部品と、その値をそう決めた理由をまとめています。
        どの技術を選んだかは
        <Link href={routes.tech} className="mx-1 text-blue-600 hover:underline">
          使用技術
        </Link>
        に書いています。
      </p>

      <div className="mt-8 space-y-10">
        <Section id="color" title="色">
          <p className="text-sm text-gray-700">
            色は <code className="text-xs">globals.css</code> の CSS 変数だけで管理しています。
            ダークモードのために各所へ <code className="text-xs">dark:</code> を書くのではなく、
            <strong>同じ変数の中身を差し替える</strong>方式です。
          </p>
          <p className="text-sm text-gray-700">
            <code className="text-xs">dark:</code> 方式だと、<code className="text-xs">bg-white</code>{" "}
            を書いた1083箇所すべてに <code className="text-xs">dark:bg-gray-900</code>{" "}
            を書き足すことになります。書き漏らした1箇所は、ダークで開いたときだけ白く光ります。
            変数を差し替えれば、<strong>書き漏らしという状態が存在しません</strong>。
          </p>
          <p className="text-sm text-gray-700">
            代償は「Tailwind の階調がそのままの意味では読めなくなる」ことです。ダークでは{" "}
            <code className="text-xs">gray-700</code> が本文、<code className="text-xs">gray-200</code>{" "}
            が枠線で、明るさの順序が反転しています。下の見本は CSS 変数を直接読んでいるので、
            右上のボタンでテーマを切り替えると実際の値が入れ替わります。
          </p>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">グレーの梯子</h3>
              <ThemeToggle />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {SHADES.map((shade) => (
                <div key={shade} className="w-16">
                  <div
                    data-swatch
                    className="h-10 w-full rounded border border-gray-200"
                    style={{ backgroundColor: `var(--color-gray-${shade})` }}
                  />
                  <div className="mt-1 text-center text-xs text-gray-500">{shade}</div>
                  {GRAY_ROLES[shade] && (
                    <div className="mt-0.5 text-center text-xs text-gray-500">{GRAY_ROLES[shade]}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Item name="意味を持つ色" note="色は飾りではなく状態を表しています。実際に当てている組み合わせです。">
            <ul className="space-y-2">
              {SEMANTIC_COLORS.map((c) => (
                <li key={c.use} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${c.className}`}>
                    {c.sample}
                  </span>
                  <span className="text-gray-700">{c.use}</span>
                  <code className="text-xs text-gray-500">{c.className}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              背景は 50〜200、文字は 700〜900 という組み合わせに揃えています。
              薄い地に濃い文字を載せる形なので、どの色でも読める比率を確保できます。
            </p>
          </Item>

          <Item
            name="ライトで手を入れているのは gray-400 だけ"
            note="ほかはすべて Tailwind の既定値をそのまま使っています。"
          >
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                既定の <code className="text-xs">gray-400</code> は白地で <strong>2.60:1</strong>{" "}
                しかなく、これを当てていた補助文字（投稿日・短縮 ID・ISBN・注記）が WCAG AA の 4.5:1
                を割っていました。文字はどれも 12px なので、大きい文字の緩和（3:1）も使えません。
              </p>
              <p>
                計算した結果、<strong>AA を満たす最も薄いグレーは実質 gray-500</strong>{" "}
                でした（白地 4.84:1）。その手前に置いても 4.5 をわずかに超える程度で、
                ブラウザ差で割れる余地が残ります。そこで 400 を 500 と同じ値にしました。
                <strong>「薄いグレーの文字」という段は AA と両立しない</strong>
                と分かったので、段そのものを消しています。
              </p>
              <p>
                淡いグレーが要る<strong>文字以外</strong>の用途（枠線・アイコン・区切り）には 200〜300
                を使います。
              </p>
            </div>
          </Item>

          <Item name="色つきの文字の下限" note="背景しだいで基準を割るので、段ごとに下限を決めています。">
            <ul className="space-y-2 text-sm">
              <li className="text-red-700">赤は red-700 まで（500・600 は背景しだいで AA を割る）</li>
              <li className="text-green-700">緑は green-700 まで</li>
              <li className="text-blue-600">青は blue-600 まで（リンクとして最も薄くできる段）</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              開いただけでは出ない文字（エラー・状態の変化）は、状態を切り替えるテストで測っています。
              静的に眺めるだけでは見つかりません。
            </p>
          </Item>
        </Section>

        <Section id="type" title="文字">
          <Item name="書体" note="欧文は Geist、日本語は OS のゴシックに落とします。">
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                日本語の Web フォントは軽いものでも数百 KB あり、
                <strong>読み込み終わるまで文字が入れ替わる</strong>代償の方が大きいと判断しました。
              </p>
              <p>
                等幅（Geist Mono）は ISBN と管理画面の ID 表示だけで使い、preload していません。
                公開側の主要な導線には出てこないためです。
              </p>
              <p className="font-mono text-xs text-gray-500">ISBN: 9784873115658（等幅の例）</p>
            </div>
          </Item>
        </Section>

        <Section id="form" title="フォームの部品">
          <p className="text-sm text-gray-700">
            投稿・編集・追記・取り下げ・出版社からの回答の5画面が、同じファイルの部品を共有しています。
            共有しているのは見た目だけでなく、
            <strong>検証と、送信用の値への変換まで含めた「フォームという振る舞い」</strong>です。
          </p>

          <Item
            name="エラーのまとめ"
            note="最初の1件で打ち切らず、全部集めて画面の並び順に出します。"
          >
            <ErrorPanelDemo />
            <p className="mt-3 text-sm text-gray-600">
              上から順に直していけるようにするためで、検証の都合で順番が飛ぶと、
              読み手に直す順序を組み立て直させることになります。各項目は該当の入力欄へ飛びます。
            </p>
          </Item>

          <Item name="文字数のカウンター" note="上限の8割に達してから出します。">
            <CharCounterDemo />
            <p className="mt-3 text-sm text-gray-600">
              最初から数字を見せると、それが目安になって書く量が引っ張られます。
              上限に近づいたときだけ出せば、警告としてだけ働きます。
            </p>
          </Item>

          <Item name="数値の入力欄" note="type=&quot;number&quot; を使わず自前で作っています。">
            <NumberFieldDemo />
            <p className="mt-3 text-sm text-gray-600">
              <code className="text-xs">type=&quot;number&quot;</code>{" "}
              は不正な値が入ると読み出せる値が<strong>空文字になります</strong>。
              全角で打った数字を半角に直そうにも、直す対象が取れません。
              変換の完了だけを見る方法も、貼り付けでは反応しないため使えませんでした。
              増減のボタンも自前です。
            </p>
          </Item>
          <Item name="選択欄" note="矢印だけ自前にしています。">
            <SelectFieldDemo />
            <p className="mt-3 text-sm text-gray-600">
              ブラウザが標準で描く矢印は<strong>枠の右端に貼り付き、文字との間が空きます</strong>。
              位置も形も CSS からは動かせないうえ、幅は最も長い選択肢で決まるので、
              短い選択肢を選んでいるときほど間延びして見えます。標準の矢印を消し、
              同じアイコン集の矢印を重ねて位置を揃えました。
            </p>
            <p className="mt-2 text-sm text-gray-600">
              重ねた矢印はクリックを受け取らないようにしてあります。そうしないと、
              <strong>矢印の上を押したときだけ開かない</strong>という、見た目では分からない壊れ方をします。
            </p>
          </Item>
        </Section>

        <Section id="display" title="表示の部品">
          <Item
            name="ステータス"
            note="1つの軸に8つの値。中間の状態は「出版社へ連絡済み」に統合しています。"
          >
            <div data-status-samples className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as ReportStatus[]).map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p>
                <strong>運営が実際にできること以上を約束する語を使わない</strong>
                、を原則にしています。「対応中」のように進んでいるように見えて中身の無いラベルは置きません。
              </p>
              <p>
                説明文はバッジの中に隠して持たせてあり、hover に依存せず読み上げられます。
              </p>
            </div>
          </Item>

          <Item name="賛同" note="押した状態を色だけで示さないようにしています。">
            <UpvoteButton
              reportId={SAMPLE_REPORT.id}
              initialCount={SAMPLE_REPORT.upvoteCount}
              initialUpvoted={false}
              viewer="guest"
              type="ERRATA"
            />
            <p className="mt-3 text-sm text-gray-600">
              賛同済みかどうかは色とアイコンの塗りつぶしで変わりますが、それだけでは支援技術に伝わりません。
              押された状態であることを属性でも持たせています（この見本は未ログイン扱いなので押すと案内へ移ります）。
            </p>
          </Item>

          <Item name="投稿のカード" note="スマホで一覧に出る形。表と同じデータを別の形で見せます。">
            <div className="max-w-md">
              <ReportCard report={SAMPLE_REPORT} />
            </div>
          </Item>
        </Section>

        <Section id="screen" title="画面の主役">
          <Item
            name="投稿の一覧"
            note="ヘッドレスのテーブルライブラリを使い、HTML と CSS は自前で書いています。"
          >
            <ReportTable data={SAMPLE_REPORTS} />
            <p className="mt-3 text-sm text-gray-600">
              並べ替え・絞り込み・ページ送りの計算だけを借りて、
              マークアップは自分で持ちます。狭い画面では表をやめてカードに切り替えます。
            </p>
          </Item>

          <Item name="メニュー" note="狭い画面ではナビをたたんでボタンにします。">
            <MenuPanelDemo />
            <p className="mt-3 text-sm text-gray-600">
              画面幅の判定はブラウザの表示領域を見るため、
              <strong>このページの中で幅を狭めても実物は切り替わりません</strong>。
              そのためボタンは同じものを置き、開いた中身は複製を並べています。
              実物はスマホで開くと見られます。
            </p>
          </Item>

          <Item name="テーマの切り替え" note="ライト・ダーク・OS の設定 の3つを順に回ります。">
            <ThemeToggle />
            <p className="mt-3 text-sm text-gray-600">
              選択は保存され、次に開いたときも維持されます。
              最初の描画より前に確定させているので、読み込み中に一瞬ライトが見えることはありません。
            </p>
          </Item>
        </Section>
      </div>

      <p className="mt-10 text-sm text-gray-600">
        判断の経緯はリポジトリの設計ドキュメントに残しています。
        <a
          href={site.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-blue-600 hover:underline"
        >
          GitHub でソースを見る
        </a>
      </p>
    </div>
  );
}
