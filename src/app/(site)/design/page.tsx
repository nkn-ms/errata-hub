import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { StatusBadge } from "@/features/report/components/report-status-badge";
import { ReportCard } from "@/features/report/components/report-card";
import { ReportTable } from "@/features/report/components/report-table";
import { UpvoteButton } from "@/features/report/components/report-upvote-button";
import { STATUS_LABELS } from "@/features/report/constants/report-status";
import type { ReportStatus } from "@/features/report/types";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";
import { SAMPLE_REPORT, SAMPLE_REPORTS } from "./fixtures";
import { CharCounterDemo, ErrorPanelDemo, NumberFieldDemo, SelectFieldDemo } from "./demos";

export const metadata: Metadata = {
  title: "デザインシステム",
  description: "Errata Hub で使っている色・文字・UI 部品と、それぞれの値を決めた基準。",
};

// グレーの階調。値は CSS 変数を直に読むので、globals.css を変えればこのページも一緒に変わる
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

// ボタンの見た目は4つだけ。ここは Button の variant をそのまま並べるので、
// 種類が増えれば型（ButtonVariant）が変わってこの配列も直すことになる。
const BUTTON_SAMPLES: { variant: ButtonVariant; label: string; use: string }[] = [
  { variant: "primary", label: "投稿する", use: "その画面の主たる操作。原則1画面に1つ" },
  { variant: "secondary", label: "キャンセル", use: "主たる操作の隣に置く、戻る側の操作" },
  { variant: "danger", label: "取り下げる", use: "取り消せない操作" },
  { variant: "dangerOutline", label: "削除", use: "破壊的だが画面の主役ではない操作（管理画面）" },
];

// 文字の段。実際に画面で使っている6段だけを、使っている組み合わせ（太さ込み）で並べる。
// px は Tailwind 既定値（rem 指定）を 16px 基準で換算したもの。
const TYPE_SCALE: { className: string; token: string; px: string; role: string }[] = [
  { className: "text-2xl font-bold", token: "text-2xl", px: "24px", role: "一覧・案内・フォームの見出し" },
  { className: "text-xl font-bold", token: "text-xl", px: "20px", role: "詳細ページ・管理画面・結果画面の見出し" },
  { className: "text-lg font-semibold", token: "text-lg", px: "18px", role: "節の見出し" },
  { className: "text-base font-semibold", token: "text-base", px: "16px", role: "カード・フォームの小見出し" },
  { className: "text-sm", token: "text-sm", px: "14px", role: "本文・入力欄・ボタン" },
  { className: "text-xs", token: "text-xs", px: "12px", role: "補助（日付・短縮 ID・注記）" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-gray-200 pt-8">
      {/* 節の見出しはサイト共通の段（text-lg font-semibold）に合わせる。
          ここで独自の段を使うと、下の「文字」の節で説明している内容とこのページ自身が食い違う。 */}
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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
        このサイトで使っている色・文字・UI 部品を、実際の画面で動いているものそのまま並べています。
        それぞれ、その形にした理由を添えました。どの技術を選んだかは
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
            <code className="text-xs">dark:</code> 方式では、色を指定している 1,000 箇所以上のクラスに、
            対になる指定を1つずつ書き足すことになります。書き漏らした1箇所は、
            ダークで開いたときだけ白く光ります。変数を差し替える方式なら、
            <strong>書き漏らしという状態がそもそも生まれません</strong>。
          </p>
          <p className="text-sm text-gray-700">
            例外は管理画面の帯だけです。ここはライトでもダークでも暗い面のままにしたいので、
            そこに限って <code className="text-xs">dark:</code> で当て直しています。
          </p>
          <p className="text-sm text-gray-700">
            代償は、階調の数字が明るさを表さなくなることです。役割は動かしていないので{" "}
            <code className="text-xs">gray-700</code> は本文、<code className="text-xs">gray-200</code>{" "}
            は枠線のままですが、ダークでは 700 の方が 200 より明るくなります。
            下の見本は CSS 変数を直接読んでいるので、テーマを切り替えると実際の値が入れ替わります。
          </p>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">グレーの階調</h3>
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
            <p className="mt-4 text-sm text-gray-600">
              右上のボタンは「OS の設定に合わせる・ライト・ダーク」の3つを順に回ります。
              選択は保存され、次に開いたときも維持されます。最初の描画より前にテーマを確定させているので、
              読み込みの途中で一瞬ライトが見えることはありません。
            </p>
          </div>

          <Item name="意味を持つ色" note="色は飾りではなく状態を表します。画面で実際に当てている組み合わせです。">
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
              背景は 50〜200、文字は 700〜900 に揃えています（意図的に控えめにするグレーだけ 600 を使います）。
              薄い地に濃い文字を載せる形なので、どの色でも読める比率を確保できます。
            </p>
          </Item>

          <Item
            name="既定値を変えたのは gray-400 だけ"
            note="ライトのグレーで、ほかの段はすべて Tailwind の既定値のままです。"
          >
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                既定の <code className="text-xs">gray-400</code> は白地で <strong>2.60:1</strong>{" "}
                しかなく、これを当てていた補助文字（投稿日・短縮 ID・ISBN・注記）が WCAG AA の 4.5:1
                を割っていました。文字はどれも 12px なので、大きい文字の緩和（3:1）も使えません。
              </p>
              <p>
                計算した結果、<strong>AA を満たす最も薄いグレーは実質 gray-500</strong>{" "}
                でした（白地 4.84:1）。400 と 500 の間に新しい値を置いても 4.5
                をわずかに超える程度にしかならず、ブラウザ差で割れる余地が残ります。
                そこで 400 を 500 と同じ値にしました。
                <strong>「薄いグレーの文字」という段は AA と両立しない</strong>
                と分かったので、段そのものを消しています。
              </p>
              <p>
                淡いグレーが要る<strong>文字以外</strong>の用途（枠線・アイコン・区切り）には 200〜300
                を使います。
              </p>
            </div>
          </Item>

          <Item name="色を付けた文字の下限" note="背景しだいで基準を割るので、色ごとに使ってよい下限を決めています。">
            <ul className="space-y-2 text-sm">
              <li className="text-red-700">赤は red-700 まで（red-600 は白地では通るが、赤い帯の上で割る）</li>
              <li className="text-green-700">緑は green-700 まで</li>
              <li className="text-blue-600">青は blue-600 まで（リンクとして最も薄くできる段）</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              エラー文言のように、操作しなければ画面に出ない文字もあります。
              こうした色は、状態を切り替えるテストの中で測っています。ページを開いて眺めるだけでは見つかりません。
            </p>
          </Item>
        </Section>

        <Section id="type" title="文字">
          <Item name="大きさの段" note="画面で使っているのはこの6段だけです。">
            <ul className="space-y-3">
              {TYPE_SCALE.map((t) => (
                <li key={t.token} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`${t.className} text-gray-900`}>見出しと本文</span>
                  <code className="text-xs text-gray-500">
                    {t.token}（{t.px}）
                  </code>
                  <span className="text-sm text-gray-700">{t.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              本文は 14px、補助的な文字は 12px です。12px は 4.5:1 を満たす色でしか使えないため、
              このサイズに使えるグレーは上で決めた下限（gray-400 = 500 相当）までに限られます。
              段の間は太さ（<code className="text-xs">font-semibold</code> /{" "}
              <code className="text-xs">font-bold</code>）で差を付け、段そのものは増やしていません。
            </p>
          </Item>

          <Item name="書体" note="欧文は Geist、日本語は OS のゴシックに落とします。">
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                日本語の Web フォントは軽いものでも数百 KB あり、
                <strong>読み込み終わるまで文字が入れ替わる</strong>代償の方が大きいと判断しました。
              </p>
              <p>
                等幅（Geist Mono）は識別子だけに使います。ISBN・操作ログの ID・メールアドレス・
                エラー画面の識別子が対象で、桁が縦に揃うと目視で照合できるためです。
                書名や本文のような散文には使いません。
              </p>
              <p className="font-mono text-xs text-gray-500">ISBN: 9784873115658（等幅の例）</p>
            </div>
          </Item>
        </Section>

        <Section id="button" title="ボタン">
          <Item name="4つの見た目" note="見た目はこの4つから選び、呼び出し側は幅・余白・並びを足します。">
            <ul className="space-y-4">
              {BUTTON_SAMPLES.map((b) => (
                <li key={b.variant} className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant={b.variant}>
                    {b.label}
                  </Button>
                  <Button type="button" variant={b.variant} disabled>
                    {b.label}
                  </Button>
                  <span className="text-sm text-gray-700">{b.use}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              右側は押せない状態です。色を薄くするだけでなく、カーソルの形も変えています。
            </p>
          </Item>
        </Section>

        <Section id="form" title="フォームの部品">
          <p className="text-sm text-gray-700">
            投稿・編集・追記・取り下げ・出版社からの回答という5つのフォームが、同じ部品を共有しています。
            うち投稿と編集は入力欄の並びがそのまま同じなので、共有しているのは見た目だけではありません。
            <strong>入力の検証と、送信用の値への変換</strong>まで同じ関数を通します。
          </p>

          <Item
            name="エラーのまとめ"
            note="最初の1件で打ち切らず、全部集めて画面の並び順に出します。"
          >
            <ErrorPanelDemo />
            <p className="mt-3 text-sm text-gray-600">
              画面の並び順に出すのは、上から順に直していけるようにするためです。
              検証の都合で順番が飛ぶと、読み手が直す順序を組み立て直すことになります。
              実際のフォームでは各項目が該当の入力欄へのリンクになっています（この見本は表示だけです）。
            </p>
          </Item>

          <Item name="文字数のカウンター" note="上限の8割に達してから出します。">
            <CharCounterDemo />
            <p className="mt-3 text-sm text-gray-600">
              最初から数字を見せると、上限そのものが目安になって「そこまで書いてよい」と読めてしまいます。
              上限に近づいたときだけ出せば、警告としてだけ働きます（GOV.UK Design System の
              Character count が同じ理由で threshold を持っています）。
            </p>
          </Item>

          <Item name="数値の入力欄" note="type=&quot;number&quot; を使わず自前で作っています。">
            <NumberFieldDemo />
            <p className="mt-3 text-sm text-gray-600">
              <code className="text-xs">type=&quot;number&quot;</code>{" "}
              は不正な値が入ると、読み出せる値が<strong>空文字になります</strong>。
              全角で「１４１」と打たれても、半角に直す対象そのものが取れません。
              日本語入力の確定を合図にして直す方法もありますが、貼り付けではその合図が来ません。
              実際に本番で、全角のまま「数字を入力してください」で止まる投稿が発生しています。
            </p>
            <p className="mt-2 text-sm text-gray-600">
              文字として受け取り、欄から離れた時点で半角へ直す形にしました。
              失われる ▲▼ と上下キーでの増減は自前で補い、
              代わりにホイールで値が勝手に変わる誤操作は起きなくなっています。
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
                <strong>運営が実際にできること以上を約束する語は使わない</strong>
                ことを原則にしています。「対応中」のように、進んでいるように見えて中身の無いラベルは置きません。
              </p>
              <p>
                各バッジは説明文を中に隠して持っています。hover で出るパネルとは別に読み上げ用の文があるので、
                マウスを乗せられない環境でも意味が伝わります。
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
              賛同済みかどうかは色とアイコンの塗りつぶしで変わりますが、見た目の差だけでは支援技術に伝わりません。
              ログインしている人には、押された状態であることを属性でも持たせています。
              この見本は未ログイン扱い＝まだ賛同の状態を持たないのでその属性は付かず、
              押すとログインの案内へ移ります。
            </p>
          </Item>

          <Item
            name="投稿の一覧（PC）"
            note="ヘッドレスのテーブルライブラリを使い、HTML と CSS は自前で書いています。"
          >
            <ReportTable data={SAMPLE_REPORTS} />
            <p className="mt-3 text-sm text-gray-600">
              並べ替え・絞り込み・ページ送りの計算だけを借り、マークアップは自分で持っています。
              画面幅が狭いときは、同じデータを次のカードに切り替えて出します。
            </p>
          </Item>

          <Item name="投稿のカード（スマホ）" note="表を縮めるのではなく、優先順位を付け直した別の形です。">
            <div className="max-w-md">
              <ReportCard report={SAMPLE_REPORT} />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              6つの列をそのまま縮めると、どの列も等しく読みにくくなります。
              カードでは「どの本の・どこが・どう間違っているか」の順に積み直し、
              書影（サムネイル）と誤/正を主役に置きました。表紙の無い本はアイコンに置き換えます
              （この見本がその状態です）。表では横に並ぶ値の優先順位が付いていませんが、
              カードでは縦の順序がそのまま優先順位になります。
            </p>
          </Item>
        </Section>
      </div>

      <p className="mt-10 text-sm text-gray-600">
        ここに書いた判断は、それぞれの実装のコメントに理由まで残しています。
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
