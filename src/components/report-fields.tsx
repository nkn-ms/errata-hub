"use client";

import { NumberField } from "@/components/number-field";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/constants/report-messages";
import { normalizeDigits, toIntOrNull } from "@/utils/parse";
import { TYPE_LABELS, MEDIUM_LABELS } from "@/constants/report-labels";
import { REPORT_LIMITS } from "@/constants/report-limits";

// 投稿の「中身」の入力欄。**新規投稿（report-form）と投稿者による編集（report-edit-form）で共有する**。
// 分けて書くと、欄の追加・上限の変更・検証条件が2か所に散り、片方だけ直る事故が起きる。
//
// ここに置くのは「投稿そのものを表す値」だけ。書籍の選択・出版社の正誤表URLの申告・画像は
// **新規投稿にしか無い**ので report-form に残している（前者2つは投稿ではなく書籍に関する情報で、
// 画像は投稿の作成後に別リクエストで送る作り）。

export type ReportType = "ERRATA" | "SUGGESTION" | "OTHER";
export type Medium = "PAPER" | "EBOOK" | "OTHER";

export type ReportFieldsValue = {
  edition: string;
  printing: string;
  reportType: ReportType;
  medium: Medium;
  page: string;
  line: string;
  hasMultiplePages: boolean;
  locationNote: string;
  ebookLocation: string;
  title: string;
  wrong: string;
  correct: string;
  content: string;
  note: string;
};

// 数値欄は文字列で持つ（全角のまま一時的に保持され、blur で半角に直る = NumberField）。
export const EMPTY_REPORT_FIELDS: ReportFieldsValue = {
  edition: "",
  printing: "",
  reportType: "ERRATA",
  medium: "PAPER",
  page: "",
  line: "",
  hasMultiplePages: false,
  locationNote: "",
  ebookLocation: "",
  title: "",
  wrong: "",
  correct: "",
  content: "",
  note: "",
};

type Patch = Partial<ReportFieldsValue>;
type Props = {
  value: ReportFieldsValue;
  onChange: (patch: Patch) => void;
};

// 数値欄（版・刷・ページ番号・行番号）の検査。問題なければ null、あればそのまま画面に出す文言を返す。
// サーバーの ReportSchema（z.number().int().positive()）と同じ条件をクライアントでも見る
export function numberFieldError(label: string, raw: string, required: boolean): string | null {
  const value = normalizeDigits(raw);
  if (value === "") return required ? `${label}を入力してください` : null;
  const parsed = toIntOrNull(value);
  if (parsed === null || parsed < 1) return `${label}は半角数字（1以上の整数）で入力してください`;
  return null;
}

// 投稿の中身の検証。**最初の1件で打ち切らず全部集める**。並べる順は画面の並び順にそろえる
// （上から直していけるようにする。検証の都合で順番が飛ぶと直す順序を組み立て直させる）。
// field には該当する入力欄の id を入れ、エラーのまとめから飛べるようにする（探させない）。
// 出典の型: GOV.UK Design System の Error summary
// https://design-system.service.gov.uk/components/error-summary/
//
// ⚠️ 書籍が選ばれているかはここでは見ない（編集では書籍を選び直さないため）。呼び出し側の責任。
export function reportFieldsErrors(v: ReportFieldsValue): { field?: string; message: string }[] {
  const found: { field?: string; message: string }[] = [];
  const isPaper = v.medium === "PAPER";

  if (isPaper) {
    // 数値欄はブラウザの検証（type="number"）に頼らず自前で見る（= NumberField のコメント）。
    // 全角は入力欄の blur で半角に直るが、"42ページ" のように直しようのない入力はここで止める
    for (const [field, label, value, required] of [
      ["edition", "版", v.edition, true],
      ["printing", "刷", v.printing, false],
    ] as const) {
      const message = numberFieldError(label, value, required);
      if (message) found.push({ field, message });
    }
  }
  if (!v.title.trim()) found.push({ field: "title", message: "タイトルを入力してください" });
  if (isPaper) {
    for (const [field, label, value, required] of [
      ["page", "ページ番号", v.page, true],
      ["line", "行番号", v.line, false],
    ] as const) {
      const message = numberFieldError(label, value, required);
      if (message) found.push({ field, message });
    }
  }
  if (v.medium === "EBOOK" && !v.ebookLocation.trim()) {
    found.push({ field: "ebook-location", message: "位置を入力してください" });
  }
  if (v.medium === "OTHER" && !v.locationNote.trim()) {
    found.push({ field: "location-memo", message: "位置メモを入力してください" });
  }
  if (v.reportType === "ERRATA") {
    if (!v.wrong.trim()) found.push({ field: "wrong", message: "誤（該当箇所）を入力してください" });
    if (!v.correct.trim()) found.push({ field: "correct", message: "正（正しい内容）を入力してください" });
    // サーバー側（ReportSchema）はトリム後に比較するので、クライアントでも揃える。
    // 揃えないと「画面では通るのにサーバーで弾かれる」ことになる。
    // 両方空のときは上の2件で足りるので、ここでは重ねて出さない
    if (v.wrong.trim() && v.wrong.trim() === v.correct.trim()) {
      found.push({ field: "correct", message: IDENTICAL_WRONG_CORRECT_MESSAGE });
    }
  } else if (!v.content.trim()) {
    found.push({ field: "content", message: "内容・提案を入力してください" });
  }
  return found;
}

// 画面の入力値をサーバーに送る形へ落とす。**選択中の媒体・種別に関係ない欄は null で送る**
// （切替前の入力残りを送信しない）。新規投稿と編集で同じ関数を通すので、片方だけ
// 「切り替え前の値が残る」ということが起きない。
export function toReportBody(v: ReportFieldsValue) {
  const isPaper = v.medium === "PAPER";
  const isErrata = v.reportType === "ERRATA";
  return {
    edition: isPaper ? toIntOrNull(v.edition) : null,
    printing: isPaper ? toIntOrNull(v.printing) : null,
    title: v.title,
    type: v.reportType,
    medium: v.medium,
    page: isPaper ? toIntOrNull(v.page) : null,
    line: isPaper ? toIntOrNull(v.line) : null,
    hasMultiplePages: isPaper && v.hasMultiplePages,
    locationNote: v.medium === "EBOOK" ? null : v.locationNote || null,
    ebookLocation: v.medium === "EBOOK" ? v.ebookLocation : null,
    wrong: isErrata ? v.wrong : null,
    correct: isErrata ? v.correct : null,
    content: isErrata ? null : v.content,
    note: v.note || null,
  };
}

// エラー1件の表示。該当する入力欄が分かるものはリンクにして、押すとその欄へ飛ばす
// （フォームが縦に長いので、どこを直すのか探させない）。
// href を持たせたうえで onClick でも focus するのは、フラグメント遷移だけでは
// ブラウザによって「スクロールはするがフォーカスは移らない」ことがあるため。
function ErrorItem({ field, message }: { field?: string; message: string }) {
  if (!field) return <>{message}</>;
  return (
    <a
      href={`#${field}`}
      onClick={(e) => {
        e.preventDefault();
        const target = document.getElementById(field);
        target?.focus();
        target?.scrollIntoView({ block: "center" });
      }}
      className="underline hover:no-underline"
    >
      {message}
    </a>
  );
}

// エラーのまとめ。置き場所は送信ボタンの真上（押した人の視線の先）。
// ⚠️ role="alert" が必要。フォーカスは押したボタンに残るので、これが無いと
//    読み上げ環境では「押したのに何も知らされない」ことになる。
export function ErrorPanel({ errors }: { errors: { field?: string; message: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
    >
      {errors.length === 1 ? (
        <ErrorItem {...errors[0]} />
      ) : (
        <>
          <p className="font-medium">{errors.length}件の入力を直してください</p>
          <ul className="mt-1.5 list-disc pl-5 space-y-1">
            {errors.map((item) => (
              <li key={`${item.field}:${item.message}`}>
                <ErrorItem {...item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// 文字数カウンター（「820/1000」）。maxLength に達すると入力できなくなるので、
// 打ち切られる前に残りが見えるようにする。自由記述の欄（タイトル・誤・正・内容/提案・備考）に付け、
// 位置・URL のような「上限まで書くことがそもそも無い」欄には付けない。
//
// 常時は出さず、上限の 80% に達してから出す。常時表示だと上限の数字自体がアンカーになり
// 「そこまで書いてよい」と読めてしまうため（同じ理由で GOV.UK Design System の Character count は
// threshold オプションを持つ: https://design-system.service.gov.uk/components/character-count/ ）。
//
// 数え方は maxLength と同じ UTF-16 コードユニット（= String#length）なので、表示と
// ブラウザの打ち切りがずれない。
// aria-live は付けない（打鍵のたびに読み上げられて邪魔になる）。入力欄の aria-describedby
// から参照させ、フォーカス時に一度読まれる形にしている。
const COUNTER_VISIBLE_RATIO = 0.8;

export function CharCounter({ id, value, max }: { id: string; value: string; max: number }) {
  const nearLimit = value.length >= max * COUNTER_VISIBLE_RATIO;
  return (
    <p
      id={id}
      // 出現時に下の入力欄がずれないよう、隠している間も高さは確保する（display:none にしない）。
      // visibility:hidden は読み上げからも外れるので、見えない間は説明としても読まれない。
      className={`mt-1 text-right text-xs text-gray-500 tabular-nums ${nearLimit ? "" : "invisible"}`}
    >
      {value.length}/{max}
    </p>
  );
}

// 「内容・提案」は唯一の完全な自由記述で、放っておくと一続きの長文になりやすい。
// 長い提案は読まれない＝出版社に届かないので、書く前に**型**を見せて分解を促す。
// 正誤情報の 誤 → 正 の2欄が既にそれを構造で効かせている例で、ここはその placeholder 版。
// ※ 文字数上限（REPORT_LIMITS.content）では短くならない。上限内で冗長に書けてしまうため、
//   効くのは「何をどの順で書くか」を示す側（上限は暴発を止める別の役目）。
// 例は種別で変える。改善提案は「どう直すとよいか」まで書けることが多いが、
// その他には**直し方まで分からない相談**（入手できない・リンクが切れている・意図が読み取れない等）が来る。
// 同じ型を出すと「直し方を書けないと投稿できない」と読めてしまい、書ける人しか投稿しない欄になる。
// （欄そのものを 誤→正 のように2つに割らなかったのも同じ理由）
const CONTENT_PLACEHOLDER = {
  suggestion: `例）
気になった点: 3章のサンプルコードが手元の環境では動かない
どう直すとよいか: 実行環境のバージョンを明記してほしい`,
  other: `例）
どんなことか: 付属データのダウンロードリンクが切れている
どうしてほしいか（あれば）: 現在の配布先を案内してほしい`,
};

// 「読んだ媒体」と、紙のときだけ出る版・刷。書籍情報のセクションに置く
// （版・刷は投稿ごとの値だが、本の話として読む方が自然なため）。
export function MediumFields({ value, onChange }: Props) {
  return (
    <>
      <div role="group" aria-labelledby="medium-label">
        <span id="medium-label" className="block text-sm font-medium text-gray-700 mb-2">読んだ媒体</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MEDIUM_LABELS) as Medium[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ medium: m })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                value.medium === m
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              {MEDIUM_LABELS[m]}
            </button>
          ))}
        </div>
        {value.medium === "EBOOK" && (
          <p className="mt-2 text-xs text-blue-600">
            電子書籍は出版社の修正で内容が更新されることがあります。ダウンロード・更新した時期が分かれば備考に記載してください。
          </p>
        )}
      </div>

      {value.medium === "PAPER" && (
        <div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="edition" className="block text-sm font-medium text-gray-700 mb-1">
                版 <span className="text-red-700">*</span>
              </label>
              <NumberField id="edition" value={value.edition} onChange={(edition) => onChange({ edition })} placeholder="例: 1" />
            </div>
            <div className="flex-1">
              <label htmlFor="printing" className="block text-sm font-medium text-gray-700 mb-1">刷（任意）</label>
              <NumberField id="printing" value={value.printing} onChange={(printing) => onChange({ printing })} placeholder="例: 2" />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">版・刷は奥付（本の最後のページ）に記載されています。</p>
        </div>
      )}
    </>
  );
}

// 「投稿内容」セクションの中身（タイトル・種別・位置・誤/正 or 内容・備考）。
export function ReportContentFields({ value, onChange }: Props) {
  const isErrataType = value.reportType === "ERRATA";

  return (
    <>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          タイトル <span className="text-red-700">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={REPORT_LIMITS.title}
          aria-describedby="title-count"
          placeholder="例: p.58「わたし」→「私」の誤植"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <CharCounter id="title-count" value={value.title} max={REPORT_LIMITS.title} />
      </div>

      <div role="group" aria-labelledby="type-label">
        <span id="type-label" className="block text-sm font-medium text-gray-700 mb-2">種別</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ reportType: t })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                value.reportType === t
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 位置情報（読んだ媒体に応じて入力欄が変わる） */}
      {value.medium === "PAPER" && (
        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="page" className="block text-sm font-medium text-gray-700 mb-1">
                ページ番号 <span className="text-red-700">*</span>
              </label>
              <NumberField id="page" value={value.page} onChange={(page) => onChange({ page })} placeholder="例: 58" />
            </div>
            <div className="flex-1">
              <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-1">行番号（任意）</label>
              <NumberField id="line" value={value.line} onChange={(line) => onChange({ line })} placeholder="例: 3" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={value.hasMultiplePages}
              onChange={(e) => onChange({ hasMultiplePages: e.target.checked })}
              className="rounded border-gray-300"
            />
            複数ページにまたがる
          </label>
          {/* 例に `p.` を付けているのは体裁ではなく、位置備考が表示側で「位置」と切り離されて
              別の枠に出るため（詳細ページ・確認画面とも）。裸の数字を書かせると、読み手には
              「171」が何を指すか分からなくなる。離れた2か所も書けると示すため列挙の例も併記する。
              この案内と下の placeholder は同じ文言で揃える（placeholder は入力を始めると消えるので、
              実際に効き続けるのはこちら）。 */}
          {value.hasMultiplePages && (
            <p className="text-xs text-blue-600 -mt-1">
              ページ範囲を位置備考に入力してください（例: p.58〜60、または p.70, p.101）
            </p>
          )}
          <div>
            <label htmlFor="location-note" className="block text-sm font-medium text-gray-700 mb-1">位置備考（任意）</label>
            <input
              id="location-note"
              type="text"
              value={value.locationNote}
              onChange={(e) => onChange({ locationNote: e.target.value })}
              maxLength={REPORT_LIMITS.locationNote}
              placeholder={value.hasMultiplePages ? "例: p.58〜60、または p.70, p.101" : "例: ページ中央の図、p.102にも同様の誤りあり"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {value.medium === "EBOOK" && (
        <div className="pl-4 border-l-2 border-gray-200">
          <label htmlFor="ebook-location" className="block text-sm font-medium text-gray-700 mb-1">
            位置 <span className="text-red-700">*</span>
          </label>
          <input
            id="ebook-location"
            type="text"
            value={value.ebookLocation}
            onChange={(e) => onChange({ ebookLocation: e.target.value })}
            maxLength={REPORT_LIMITS.ebookLocation}
            placeholder="例: 位置No.1234、35%、p.58"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {value.medium === "OTHER" && (
        <div className="pl-4 border-l-2 border-gray-200">
          <label htmlFor="location-memo" className="block text-sm font-medium text-gray-700 mb-1">
            位置メモ <span className="text-red-700">*</span>
          </label>
          <input
            id="location-memo"
            type="text"
            value={value.locationNote}
            onChange={(e) => onChange({ locationNote: e.target.value })}
            maxLength={REPORT_LIMITS.locationNote}
            placeholder="例: 第3章「◯◯」の節、サンプルコードzip内のreadme"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* 誤→正 or 内容 */}
      {isErrataType ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="wrong" className="block text-sm font-medium text-gray-700 mb-1">
              誤（該当箇所） <span className="text-red-700">*</span>
            </label>
            <textarea
              id="wrong"
              value={value.wrong}
              onChange={(e) => onChange({ wrong: e.target.value })}
              maxLength={REPORT_LIMITS.wrong}
              aria-describedby="wrong-count"
              rows={2}
              placeholder="誤りのある文章をそのまま入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <CharCounter id="wrong-count" value={value.wrong} max={REPORT_LIMITS.wrong} />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <label htmlFor="correct" className="block text-sm font-medium text-gray-700">
                正（正しい内容） <span className="text-red-700">*</span>
              </label>
              {/* 誤の全文を持ってきて、違う数文字だけ直せるようにする（長い引用を2回打たせない）。
                  ⚠️ 上書きはしない（打ち込んだ内容を黙って消さない）。すでに正が埋まっているときは
                     押せない状態にして、消したい人には自分で消してもらう。 */}
              <button
                type="button"
                onClick={() => onChange({ correct: value.wrong })}
                disabled={!value.wrong.trim() || value.correct.length > 0}
                className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                誤の内容をコピー
              </button>
            </div>
            <textarea
              id="correct"
              value={value.correct}
              onChange={(e) => onChange({ correct: e.target.value })}
              maxLength={REPORT_LIMITS.correct}
              aria-describedby="correct-count"
              rows={2}
              placeholder="正しいと思われる内容を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {/* 誤と正が同じまま送ると弾かれる（= #133）が、それはここでは知らせない。
                「コピー → 直す」の途中で必ず通る状態なので、まだ間違っていない人に警告を出すことになる。
                検証は他の項目と同じく送信時にまとめて出す（エラーは送信ボタンの真上に出る）。 */}
            <CharCounter id="correct-count" value={value.correct} max={REPORT_LIMITS.correct} />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            内容・提案 <span className="text-red-700">*</span>
          </label>
          <textarea
            id="content"
            value={value.content}
            onChange={(e) => onChange({ content: e.target.value })}
            maxLength={REPORT_LIMITS.content}
            aria-describedby="content-count"
            rows={4}
            placeholder={value.reportType === "OTHER" ? CONTENT_PLACEHOLDER.other : CONTENT_PLACEHOLDER.suggestion}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <CharCounter id="content-count" value={value.content} max={REPORT_LIMITS.content} />
        </div>
      )}

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
        <textarea
          id="note"
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
          maxLength={REPORT_LIMITS.note}
          aria-describedby="note-count"
          rows={2}
          placeholder="その他補足があれば記載してください"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <CharCounter id="note-count" value={value.note} max={REPORT_LIMITS.note} />
      </div>
    </>
  );
}
