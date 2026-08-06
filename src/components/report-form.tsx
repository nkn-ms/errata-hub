"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookSearch } from "@/components/book-search";
import { NumberField } from "@/components/number-field";
import { findErratumUrlByIsbn } from "@/app/actions/book";
import { useRouter } from "next/navigation";
import { createReport, type ReportInput } from "@/app/actions/report";
import { IDENTICAL_WRONG_CORRECT_MESSAGE } from "@/constants/report-messages";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";
import { normalizeDigits, toIntOrNull } from "@/utils/parse";
import { TYPE_LABELS, MEDIUM_LABELS } from "@/constants/report-labels";
import { REPORT_LIMITS } from "@/constants/report-limits";
import {
  REPORT_IMAGE_ALLOWED_TYPES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
  REPORT_IMAGE_MAX_MB,
  REPORT_IMAGE_MAX_SOURCE_BYTES,
  REPORT_IMAGE_MAX_SOURCE_MB,
} from "@/constants/report-images";
import { compressImage } from "@/utils/image-compress";

type BookData = {
  googleBooksId: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

type ReportType = "ERRATA" | "SUGGESTION" | "OTHER";
type Medium = "PAPER" | "EBOOK" | "OTHER";

// 数値欄（版・刷・ページ番号・行番号）の検査。問題なければ null、あればそのまま画面に出す文言を返す。
// サーバーの ReportSchema（z.number().int().positive()）と同じ条件をクライアントでも見る
export function numberFieldError(label: string, raw: string, required: boolean): string | null {
  const value = normalizeDigits(raw);
  if (value === "") return required ? `${label}を入力してください` : null;
  const parsed = toIntOrNull(value);
  if (parsed === null || parsed < 1) return `${label}は半角数字（1以上の整数）で入力してください`;
  return null;
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

// 画面の主役が入れ替わる場面（確認画面へ進む・画像の失敗を知らせる）で、そこへ視線とフォーカスを移す。
// 理由は2つあり、どちらも実機で確認した:
//   - 投稿ボタンはフォームの下端にある。フォームが畳まれてもスクロール位置は下のままなので、
//     何もしないと差し替えた中身が画面の外に出る（撮ったスクリーンショットで見出しが切れていた）
//   - 押したボタン自体が消えるのでフォーカスが body に落ちる。読み上げ環境で迷子になる
// ⚠️ focus() 任せにすると足りない。focus() は「見える位置まで」しかスクロールせず、
//    ヘッダー（sticky top-0）に隠れている分は考慮しないので、実測で1行目が帯の下に潜った。
//    差し替えた中身はページの先頭なので、素直に先頭まで戻してからフォーカスだけ移す。
// 出典の型: GOV.UK Design System の Error summary（読み込み時にフォーカスを移す）
// https://design-system.service.gov.uk/components/error-summary/
function useFocusOnAppear(appeared: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!appeared) return;
    window.scrollTo({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [appeared]);
  return ref;
}

// エラーの置き場所は投稿ボタンの真上（押した人の視線の先）。フォーム・確認画面の両方で使う。
// ⚠️ role="alert" が必要。フォーカスは押したボタンに残るので、これが無いと
//    読み上げ環境では「押したのに何も知らされない」ことになる。
function ErrorPanel({ errors }: { errors: { field?: string; message: string }[] }) {
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

// 確認画面の1行。ラベルと値を横に並べ、幅が足りないときは縦に折る。
// 値は whitespace-pre-wrap で描く（誤・正・内容は複数行で書かれるため、入力どおりに見せる）。
function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-gray-100 py-2 first:border-t-0 first:pt-0 sm:flex-row sm:gap-4">
      <dt className="flex-shrink-0 text-sm text-gray-500 sm:w-32">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-gray-900 whitespace-pre-wrap break-words tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function CharCounter({ id, value, max }: { id: string; value: string; max: number }) {
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

type Props = {
  // 書籍ページの「この本に投稿する」から来たとき、その本を確定済みとして受け取る。
  // 渡された場合は書籍検索を出さず、確定表示（編集不可）にする。
  initialBook?: BookData | null;
  initialErratumUrl?: string | null;
};

export function ReportForm({ initialBook = null, initialErratumUrl = null }: Props = {}) {
  const router = useRouter();
  // 書籍が確定済みで来たかどうか。以降「検索欄を出すか」「別の本へ逃げる導線を出すか」の判断に使う
  const bookPreselected = initialBook !== null;
  const [book, setBook] = useState<BookData | null>(initialBook);
  const [edition, setEdition] = useState("");
  const [printing, setPrinting] = useState("");
  const [reportType, setReportType] = useState<ReportType>("ERRATA");
  const [medium, setMedium] = useState<Medium>("PAPER");
  const [page, setPage] = useState("");
  const [line, setLine] = useState("");
  const [hasMultiplePages, setHasMultiplePages] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [ebookLocation, setEbookLocation] = useState("");
  const [title, setTitle] = useState("");
  const [wrong, setWrong] = useState("");
  const [correct, setCorrect] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [reportedErratumUrl, setReportedErratumUrl] = useState("");
  // 選んだ本に公式の正誤表が既に登録されていれば、投稿前にそれを案内する（重複投稿を減らす）
  const [knownErratumUrl, setKnownErratumUrl] = useState<string | null>(initialErratumUrl);
  // File と表示用の object URL をペアで持つ（URL は削除時・投稿後に revoke する）
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  // 検証を通った送信内容。ここに値が入るとフォームを畳んで確認画面に差し替える。
  // 「入力中か確認中か」を別のフラグで持たず送信内容そのもので表すのは、確認画面に出すものと
  // createReport に渡すものを同じ1つの値にするため（別々に組み立てると食い違う余地ができる）。
  const [pending, setPending] = useState<ReportInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 圧縮はデコードを伴うので数百ms かかる。終わるまで投稿させない（未処理のまま送らないため）
  const [compressing, setCompressing] = useState(false);
  // 添付画像の拡大表示。圧縮で文字が読めなくなっていないかを投稿前に自分で確かめられるようにする。
  // <dialog> を使うのは ESC で閉じる挙動とフォーカス管理がネイティブで付いてくるため。
  const zoomRef = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState<{ url: string; name: string } | null>(null);
  // エラーは配列で持ち、投稿時の検証は**全項目を見てからまとめて出す**。
  // 1件ずつ出すと「押す→スクロールして直す→また押す」を必須項目の数だけ繰り返させることになる
  // （このフォームは縦に長く、必須が離れて散っている）。
  // field には該当する入力欄の id を入れ、サマリーから飛べるようにする（探させない）。
  // 出典の型: GOV.UK Design System の Error summary
  // https://design-system.service.gov.uk/components/error-summary/
  const [errors, setErrors] = useState<{ field?: string; message: string }[]>([]);
  // 1件だけのとき（画像の選択エラー・サーバーからの応答）に使う糖衣
  const setError = (message: string) => setErrors(message ? [{ message }] : []);
  // 「投稿は作られたが画像の一部が付かなかった」状態。ここに値が入るとフォームごと知らせに差し替える
  // （なぜ差し替えるかは下の setImageUploadFailure のところに書いた）
  const [imageUploadFailure, setImageUploadFailure] = useState<{
    reportId: string;
    failedCount: number;
  } | null>(null);
  const confirmRef = useFocusOnAppear(pending !== null);
  const failureRef = useFocusOnAppear(imageUploadFailure !== null);

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じファイルの再選択でも change を発火させる
    setError("");
    setCompressing(true);
    const next = [...images];
    try {
      for (const file of files) {
        // push する前の空き確認（上限ちょうど＝満杯、なのでこれ以上は追加しない）
        const isFull = next.length >= REPORT_IMAGE_MAX_COUNT;
        if (isFull) {
          setError(`画像は${REPORT_IMAGE_MAX_COUNT}枚までです`);
          break;
        }
        if (!REPORT_IMAGE_ALLOWED_TYPES[file.type]) {
          setError("画像は JPEG / PNG / WebP のみ添付できます");
          continue;
        }
        // 上限の検査は「圧縮前」と「圧縮後」の2段。前者はデコードでブラウザが固まるのを防ぐ枠で、
        // 後者が本来の上限。スマホの写真は素で 3〜4MB 出るので、圧縮前に 4MB で弾くと
        // 「縮めれば通るはずの写真」を投稿できなくなる（圧縮を入れる前はそうなっていた）。
        if (file.size > REPORT_IMAGE_MAX_SOURCE_BYTES) {
          setError(`画像は1枚${REPORT_IMAGE_MAX_SOURCE_MB}MB以下にしてください`);
          continue;
        }
        const compressed = await compressImage(file);
        if (compressed.size > REPORT_IMAGE_MAX_BYTES) {
          setError(`縮小しても${REPORT_IMAGE_MAX_MB}MBを超えるため添付できません`);
          continue;
        }
        next.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
      }
      setImages(next);
    } finally {
      setCompressing(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const isErrataType = reportType === "ERRATA";
  const isPaper = medium === "PAPER";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // 検証は最初の1件で打ち切らず全部集める。並べる順は**画面の並び順**にそろえる
    // （上から直していけるようにする。検証の都合で順番が飛ぶと直す順序を組み立て直させる）。
    const found: { field?: string; message: string }[] = [];

    // 未選択のときだけ。ISBN の無い本は選べない作りなので「ISBN が無い」検査は置かない:
    //   タイトル検索は ISBN の無い候補を一覧から外し（book-search.tsx の filter）、
    //   ISBN 検索は検索に使った ISBN が必ず入り、書籍ページ由来は DB の Book.isbn（NOT NULL）。
    // 到達しない分岐を残すと「ISBN の無い本が選べる経路がある」と読ませてしまう。
    // 万一の経路はサーバーが弾く（ReportSchema の isbn 必須 ＋ toCanonicalIsbn）
    if (!book) {
      found.push({ field: "book-search", message: "書籍を選択してください" });
    }
    if (isPaper) {
      // 数値欄はブラウザの検証（type="number"）に頼らず自前で見る（= NumberField のコメント）。
      // 全角は入力欄の blur で半角に直るが、"42ページ" のように直しようのない入力はここで止める
      for (const [field, label, value, required] of [
        ["edition", "版", edition, true],
        ["printing", "刷", printing, false],
      ] as const) {
        const message = numberFieldError(label, value, required);
        if (message) found.push({ field, message });
      }
    }
    if (!title.trim()) found.push({ field: "title", message: "タイトルを入力してください" });
    if (isPaper) {
      for (const [field, label, value, required] of [
        ["page", "ページ番号", page, true],
        ["line", "行番号", line, false],
      ] as const) {
        const message = numberFieldError(label, value, required);
        if (message) found.push({ field, message });
      }
    }
    if (medium === "EBOOK" && !ebookLocation.trim()) {
      found.push({ field: "ebook-location", message: "位置を入力してください" });
    }
    if (medium === "OTHER" && !locationNote.trim()) {
      found.push({ field: "location-note", message: "位置メモを入力してください" });
    }
    if (isErrataType) {
      if (!wrong.trim()) found.push({ field: "wrong", message: "誤（該当箇所）を入力してください" });
      if (!correct.trim()) found.push({ field: "correct", message: "正（正しい内容）を入力してください" });
      // サーバー側（ReportSchema）はトリム後に比較するので、クライアントでも揃える。
      // 揃えないと「画面では通るのにサーバーで弾かれる」ことになる。
      // 両方空のときは上の2件で足りるので、ここでは重ねて出さない
      if (wrong.trim() && wrong.trim() === correct.trim()) {
        found.push({ field: "correct", message: IDENTICAL_WRONG_CORRECT_MESSAGE });
      }
    } else if (!content.trim()) {
      found.push({ field: "content", message: "内容・提案を入力してください" });
    }

    // `|| !book` は型の絞り込みも兼ねる（book が null なら必ず found に入るので条件としては冗長だが、
    // これを書かないと下の setPending で BookData | null のままになる。
    // 「実際には来ない早期 return」を別に足すよりこちらの方が死んだ分岐を作らない）
    if (found.length > 0 || !book) {
      setErrors(found);
      return;
    }

    // 検証を通ってもここでは送らず、確認画面に差し替える。
    // 選択中の媒体・種別に関係ない欄は null で送る（切替前の入力残りを送信しない）
    setError("");
    setPending({
      book,
      edition: isPaper ? toIntOrNull(edition) : null,
      printing: isPaper ? toIntOrNull(printing) : null,
      title,
      type: reportType,
      medium,
      page: isPaper ? toIntOrNull(page) : null,
      line: isPaper ? toIntOrNull(line) : null,
      hasMultiplePages: isPaper && hasMultiplePages,
      locationNote: medium === "EBOOK" ? null : locationNote || null,
      ebookLocation: medium === "EBOOK" ? ebookLocation : null,
      wrong: isErrataType ? wrong : null,
      correct: isErrataType ? correct : null,
      content: isErrataType ? null : content,
      note: note || null,
      // 登録済みの本では入力欄を出していないので、書籍を選び直す前に入力された値も送らない
      reportedErratumUrl: knownErratumUrl ? null : reportedErratumUrl.trim() || null,
    });
  }

  // 確認画面の「投稿する」。サーバーへ送る経路はここだけで、渡すのは確認画面に出したものそのもの。
  async function submitReport(input: ReportInput) {
    setSubmitting(true);
    setError("");

    try {
      const created = await createReport(input);

      if (created.error !== undefined) {
        setError(created.error);
        return;
      }

      // 画像は投稿の作成後に1枚ずつアップロードする（1リクエスト1ファイル。
      // Server Actions のボディ上限 1MB を超えるため、画像だけは API Route で送る。
      // まとめて送ると Vercel のボディ上限 4.5MB も超えうるため直列送信）。
      if (images.length > 0) {
        let failedCount = 0;
        for (const { file } of images) {
          const formData = new FormData();
          formData.append("file", file);
          const upload = await fetch(routes.api.reportImages(created.id), {
            method: "POST",
            body: formData,
          });
          if (!upload.ok) failedCount++;
        }
        if (failedCount > 0) {
          // 「留まる」も「進む」も使えない場面なので、フォームそのものを知らせに差し替える。
          //   - フォームに留めると再送信＝二重投稿になる（投稿はもう作られている）
          //   - かといって router.push した後に setError しても、その画面はもう無い
          // 差し替えなら form が消えるので二重投稿はあり得ず、知らせは遷移と競合しない。
          images.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
          setImageUploadFailure({ reportId: created.id, failedCount });
          return;
        }
      }
      images.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      router.push(routes.home);
    } catch {
      setError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  // 投稿は作られたが画像の一部が付かなかったとき。フォームを畳んで結果だけを出す。
  // 色を赤（errors と同じ）にしないのは、投稿自体は成功しているため。
  if (imageUploadFailure) {
    return (
      <div className="space-y-4">
        <div
          ref={failureRef}
          // tabIndex={-1} は「キーボードの Tab 順には入れないが、focus() では受け取れる」の意味。
          // これが無いと div にフォーカスを移せない
          tabIndex={-1}
          role="alert"
          className="rounded-md bg-amber-50 border border-amber-200 px-4 py-4 text-amber-900 focus:outline-none"
        >
          <p className="font-medium">投稿しました</p>
          <p className="mt-1 text-sm">
            ただし、画像{imageUploadFailure.failedCount}枚は添付できませんでした。投稿の内容は保存されています。
          </p>
          {/* 投稿者が自分で添付し直す手段が無いので、窓口を出さないとここが行き止まりになる。
              ⚠️ 投稿者による修正機能ができたら、この1行は不要になる（そちらへ案内する） */}
          <p className="mt-1 text-sm">
            添付し直すには <a href={`mailto:${site.contactEmail}`} className="underline">{site.contactEmail}</a> までご連絡ください。
          </p>
        </div>

        {/* 並びはフォームの footer と同じ（主要な行き先を右に置く） */}
        <div className="flex gap-3 justify-end">
          <Link
            href={routes.home}
            className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            トップへ
          </Link>
          <Link
            href={routes.report(imageUploadFailure.reportId)}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            投稿を見る
          </Link>
        </div>
      </div>
    );
  }

  // 確認画面。フォームを畳んで「これから送るもの」だけを出す。
  // ⚠️ imageUploadFailure より後に置く（投稿が済んだ後に出すのは確認ではなく結果）。
  // 並びはフォームと同じ順・ラベルもフォームと同じ言葉にする。直すときに戻るのはフォームなので、
  // 「どの欄を直せばよいか」が言葉の一致で分かる方がよい。
  // 任意の欄は空なら行ごと出さない（「未入力」の行が並ぶと、書いた内容の方が埋もれる）。
  if (pending) {
    return (
      <div className="space-y-6">
        <div ref={confirmRef} tabIndex={-1} className="focus:outline-none">
          <h2 className="text-lg font-semibold text-gray-900">この内容で投稿します</h2>
          <p className="mt-1 text-sm text-gray-500">
            投稿後は自分で修正できません。内容をご確認ください。
          </p>
        </div>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <dl>
            <SummaryRow label="書籍">
              <span className="font-medium">{pending.book.title}</span>
              <span className="block text-gray-500">
                {[pending.book.author, pending.book.publisher].filter(Boolean).join(" / ")}
              </span>
              <span className="block text-gray-500">
                ISBN: <span className="font-mono">{pending.book.isbn}</span>
              </span>
            </SummaryRow>

            <SummaryRow label="読んだ媒体">{MEDIUM_LABELS[pending.medium]}</SummaryRow>

            {pending.medium === "PAPER" && (
              <SummaryRow label="版・刷">
                第{pending.edition}版{pending.printing && ` 第${pending.printing}刷`}
              </SummaryRow>
            )}

            <SummaryRow label="タイトル">{pending.title}</SummaryRow>
            <SummaryRow label="種別">{TYPE_LABELS[pending.type]}</SummaryRow>

            {pending.medium === "PAPER" && (
              <SummaryRow label="位置">
                p.{pending.page}
                {pending.line && ` l.${pending.line}`}
                {pending.hasMultiplePages && " 他"}
              </SummaryRow>
            )}
            {pending.medium === "EBOOK" && (
              <SummaryRow label="位置">{pending.ebookLocation}</SummaryRow>
            )}
            {pending.medium === "OTHER" && (
              <SummaryRow label="位置メモ">{pending.locationNote}</SummaryRow>
            )}
            {pending.medium === "PAPER" && pending.locationNote && (
              <SummaryRow label="位置備考">{pending.locationNote}</SummaryRow>
            )}

            {pending.type === "ERRATA" ? (
              <>
                <SummaryRow label="誤（該当箇所）">{pending.wrong}</SummaryRow>
                <SummaryRow label="正（正しい内容）">{pending.correct}</SummaryRow>
              </>
            ) : (
              <SummaryRow label="内容・提案">{pending.content}</SummaryRow>
            )}

            {pending.note && <SummaryRow label="備考">{pending.note}</SummaryRow>}
            {pending.reportedErratumUrl && (
              <SummaryRow label="出版社の正誤表URL">{pending.reportedErratumUrl}</SummaryRow>
            )}

            {/* 画像だけは送信内容（pending）に無い。投稿の作成後に別リクエストで送るため
                （下の submitReport のコメント参照）。ここは選択中のファイルをそのまま出す。
                映しているのは圧縮後のファイルから作ったプレビューなので、**ここで見えているものが
                実際に送られるもの**と一致する */}
            {images.length > 0 && (
              <SummaryRow label="画像">
                <div className="flex flex-wrap gap-2">
                  {images.map(({ file, previewUrl }) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={previewUrl}
                      src={previewUrl}
                      alt={file.name}
                      className="h-20 w-auto rounded border border-gray-200 object-contain bg-gray-50"
                    />
                  ))}
                </div>
              </SummaryRow>
            )}
          </dl>
        </section>

        <ErrorPanel errors={errors} />

        {/* 並びはフォームの footer と同じ（主要な行き先を右に置く） */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            修正する
          </button>
          <button
            type="button"
            onClick={() => submitReport(pending)}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "投稿中..." : "投稿する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        投稿の前に、<strong>出版社の公式な正誤表を確認してください</strong>。すでに掲載されている誤りは投稿不要です。
        正誤表がまだ登録されていない場合は、下の「出版社の正誤表URL」欄から登録にご協力ください。
      </p>
      {/* 書籍情報 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">書籍情報</h2>

        <div role="group" aria-labelledby="book-label">
          <span id="book-label" className="block text-sm font-medium text-gray-700 mb-1">
            書籍名 {!bookPreselected && <span className="text-red-700">*</span>}
          </span>
          {bookPreselected && book ? (
            // 確定済みなので検索させない。見た目は検索で選んだ直後と同じカードに揃える
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                {book.coverImageUrl ? (
                  <Image src={book.coverImageUrl} alt="" width={48} height={64} unoptimized className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{book.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{book.author}</div>
                  <div className="text-xs text-gray-500">{book.publisher}</div>
                  {book.isbn && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      ISBN: <span className="font-mono">{book.isbn}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* 誤って別の本のページから来ても詰まないよう、検索し直す導線は残す */}
              <Link href={routes.submit} className="text-xs text-blue-600 hover:underline">
                別の本を選ぶ
              </Link>
            </div>
          ) : (
            <BookSearch
              onSelect={async (selected) => {
                setBook(selected);
                setKnownErratumUrl(null);
                if (selected.isbn) {
                  const { erratumUrl } = await findErratumUrlByIsbn(selected.isbn);
                  setKnownErratumUrl(erratumUrl);
                }
              }}
            />
          )}
          {knownErratumUrl && (
            <p className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
              この本には出版社の正誤表があります。
              <a
                href={knownErratumUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline font-medium"
              >
                正誤表を確認する →
              </a>
              <br />
              すでに掲載されている誤りは投稿不要です。
            </p>
          )}
        </div>

        <div role="group" aria-labelledby="medium-label">
          <span id="medium-label" className="block text-sm font-medium text-gray-700 mb-2">読んだ媒体</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MEDIUM_LABELS) as Medium[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMedium(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  medium === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                }`}
              >
                {MEDIUM_LABELS[m]}
              </button>
            ))}
          </div>
          {medium === "EBOOK" && (
            <p className="mt-2 text-xs text-blue-600">
              電子書籍は出版社の修正で内容が更新されることがあります。ダウンロード・更新した時期が分かれば備考に記載してください。
            </p>
          )}
        </div>

        {isPaper && (
        <div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="edition" className="block text-sm font-medium text-gray-700 mb-1">
              版 <span className="text-red-700">*</span>
            </label>
            <NumberField id="edition" value={edition} onChange={setEdition} placeholder="例: 1" />
          </div>
          <div className="flex-1">
            <label htmlFor="printing" className="block text-sm font-medium text-gray-700 mb-1">刷（任意）</label>
            <NumberField id="printing" value={printing} onChange={setPrinting} placeholder="例: 2" />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">版・刷は奥付（本の最後のページ）に記載されています。</p>
        </div>
        )}
      </section>

      {/* 投稿内容 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">投稿内容</h2>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            タイトル <span className="text-red-700">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={REPORT_LIMITS.title}
            aria-describedby="title-count"
            placeholder="例: p.42「わたし」→「私」の誤植"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <CharCounter id="title-count" value={title} max={REPORT_LIMITS.title} />
        </div>

        <div role="group" aria-labelledby="type-label">
          <span id="type-label" className="block text-sm font-medium text-gray-700 mb-2">種別</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  reportType === t
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
        {medium === "PAPER" && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-200">
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="page" className="block text-sm font-medium text-gray-700 mb-1">
                  ページ番号 <span className="text-red-700">*</span>
                </label>
                <NumberField id="page" value={page} onChange={setPage} placeholder="例: 42" />
              </div>
              <div className="flex-1">
                <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-1">行番号（任意）</label>
                <NumberField id="line" value={line} onChange={setLine} placeholder="例: 3" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMultiplePages}
                onChange={(e) => setHasMultiplePages(e.target.checked)}
                className="rounded border-gray-300"
              />
              複数ページにまたがる
            </label>
            {hasMultiplePages && (
              <p className="text-xs text-blue-600 -mt-1">
                ページ範囲を位置備考に入力してください（例: 42〜44、または 42, 43, 44）
              </p>
            )}
            <div>
              <label htmlFor="location-note" className="block text-sm font-medium text-gray-700 mb-1">位置備考（任意）</label>
              <input
                id="location-note"
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                maxLength={REPORT_LIMITS.locationNote}
                placeholder={hasMultiplePages ? "例: 42〜44、または 42, 43, 44" : "例: ページ中央の図、p.102にも同様の誤りあり"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {medium === "EBOOK" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label htmlFor="ebook-location" className="block text-sm font-medium text-gray-700 mb-1">
              位置 <span className="text-red-700">*</span>
            </label>
            <input
              id="ebook-location"
              type="text"
              value={ebookLocation}
              onChange={(e) => setEbookLocation(e.target.value)}
              maxLength={REPORT_LIMITS.ebookLocation}
              placeholder="例: 位置No.1234、43%、p.42"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {medium === "OTHER" && (
          <div className="pl-4 border-l-2 border-gray-200">
            <label htmlFor="location-memo" className="block text-sm font-medium text-gray-700 mb-1">
              位置メモ <span className="text-red-700">*</span>
            </label>
            <input
              id="location-memo"
              type="text"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
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
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                maxLength={REPORT_LIMITS.wrong}
                aria-describedby="wrong-count"
                rows={2}
                placeholder="誤りのある文章をそのまま入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <CharCounter id="wrong-count" value={wrong} max={REPORT_LIMITS.wrong} />
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
                  onClick={() => setCorrect(wrong)}
                  disabled={!wrong.trim() || correct.length > 0}
                  className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  誤の内容をコピー
                </button>
              </div>
              <textarea
                id="correct"
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                maxLength={REPORT_LIMITS.correct}
                aria-describedby="correct-count"
                rows={2}
                placeholder="正しいと思われる内容を入力してください"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {/* 誤と正が同じまま送ると弾かれる（= #133）が、それはここでは知らせない。
                  「コピー → 直す」の途中で必ず通る状態なので、まだ間違っていない人に警告を出すことになる。
                  検証は他の項目と同じく投稿時にまとめて出す（エラーは投稿ボタンの真上に出る）。 */}
              <CharCounter id="correct-count" value={correct} max={REPORT_LIMITS.correct} />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              内容・提案 <span className="text-red-700">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={REPORT_LIMITS.content}
              aria-describedby="content-count"
              rows={4}
              placeholder={reportType === "OTHER" ? CONTENT_PLACEHOLDER.other : CONTENT_PLACEHOLDER.suggestion}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <CharCounter id="content-count" value={content} max={REPORT_LIMITS.content} />
          </div>
        )}

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={REPORT_LIMITS.note}
            aria-describedby="note-count"
            rows={2}
            placeholder="その他補足があれば記載してください"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <CharCounter id="note-count" value={note} max={REPORT_LIMITS.note} />
        </div>

        {/* この欄の目的は「管理者がまだ知らないURLを教えてもらう」こと。既に登録済みの本では
            申告してもらう必要が無いので、入力欄を出さずに登録済みであることだけを伝える
            （出したままだと、画面上部で「正誤表があります」と案内しながら下部で同じものを
            入力させることになる）。 */}
        {knownErratumUrl ? (
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">出版社の正誤表URL</span>
            <p className="text-xs text-gray-500">
              この本には登録済みの{" "}
              <a
                href={knownErratumUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue-600 underline"
              >
                正誤表
              </a>
              {" "}があるため、申告は不要です。
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="reported-erratum-url" className="block text-sm font-medium text-gray-700 mb-1">
              出版社の正誤表URL（任意）
            </label>
            <p className="text-xs text-gray-500 mb-2">
              確認した正誤表のURLを登録してください。管理者が正規のURLであることを確認のうえ、書籍ページに
              公式リンクとして掲載します。
            </p>
            <input
              id="reported-erratum-url"
              type="url"
              value={reportedErratumUrl}
              onChange={(e) => setReportedErratumUrl(e.target.value)}
              maxLength={REPORT_LIMITS.reportedErratumUrl}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          {/* ここは <label> にしない。下の「ファイルを選択」が input のラベル兼クリック領域で、
              label が2つあると読み上げ・getByLabel の解決が曖昧になるため */}
          <p className="block text-sm font-medium text-gray-700 mb-1">
            画像（任意・{REPORT_IMAGE_MAX_COUNT}枚まで）
          </p>
          {/* 添付する動機は選ぶ前（ボタンの上）に、守るべき制約は選ぶときに（ボタンの下）に置く。
              まとめて並べると読む塊が大きくなり、いちばん読ませたい1文目が埋もれるため。
              ⚠️ 「任意」はラベルが言っているのでここでは繰り返さない。また対応の早さなど
                 運営が保証できないことは書かない（誇張しない） */}
          <p className="text-xs text-gray-500 mb-2">
            該当箇所の画像があると出版社が確認しやすくなります。
          </p>
          {images.length < REPORT_IMAGE_MAX_COUNT && (
            <>
              {/* input 本体は視覚的に隠し、<label> をボタンとして見せる。
                  素の input はブラウザが描く「選択されていません」まで含めて要素全体が
                  クリック可能で、当たり判定がボタンの見た目より広い（実測: 隣の入力欄の
                  オートフィル候補を押したつもりでファイル選択が開く）。
                  ⚠️ sr-only であって display:none ではない。隠すとフォーカスできず
                     キーボード操作と読み上げが壊れる。peer-focus でラベル側に輪郭を出す。
                  ⚠️ 「選択されていません」表示が消えるのも同じ修正の効果（handleImageSelect が
                     e.target.value を空に戻すため、実体は state 側にあるのに未選択と表示されていた）。 */}
              <input
                id="images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelect}
                disabled={compressing}
                className="peer sr-only"
              />
              <label
                htmlFor="images"
                className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
              >
                ファイルを選択
              </label>
              <p className="mt-2 text-xs text-gray-500">
                該当箇所が分かる画像や、指摘の根拠となる資料を、指摘に必要な範囲で添付してください
                （JPEG / PNG / WebP・1枚{REPORT_IMAGE_MAX_SOURCE_MB}MBまで）。大きい画像は自動で縮小され、
                縮小後に{REPORT_IMAGE_MAX_MB}MBを超えるものは添付できません。
              </p>
            </>
          )}
          {compressing && <p className="mt-2 text-xs text-gray-500">画像を処理しています…</p>}
          {images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {images.map(({ file, previewUrl }, index) => (
                <div key={previewUrl} className="relative">
                  {/* クリックで拡大。縮小後に紙面の文字が読めるかを投稿前に確かめるための導線
                      （プレビューが小さいままだと劣化に気づけない）。button にしてキーボードでも開ける */}
                  <button
                    type="button"
                    onClick={() => {
                      setZoomed({ url: previewUrl, name: file.name });
                      zoomRef.current?.showModal();
                    }}
                    className="cursor-zoom-in"
                    aria-label={`${file.name} を拡大`}
                  >
                    {/* 選択中ファイルのローカルプレビュー（blob: URL）なので next/image は使わない */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`${file.name} を削除`}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 添付画像の拡大表示。backdrop クリックでも閉じられるよう、中身を1枚の button で覆う。
          ⚠️ <dialog> の閉じる操作（ESC）はネイティブ任せで、onClose で state を捨てる */}
      <dialog
        ref={zoomRef}
        onClose={() => setZoomed(null)}
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-lg bg-transparent p-0 backdrop:bg-black/60"
      >
        {zoomed && (
          <button
            type="button"
            onClick={() => zoomRef.current?.close()}
            className="block cursor-zoom-out"
            aria-label="拡大表示を閉じる"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomed.url}
              alt={zoomed.name}
              className="max-h-[90dvh] max-w-[90vw] rounded-lg bg-white object-contain"
            />
          </button>
        )}
      </dialog>

      <ErrorPanel errors={errors} />

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.push(routes.home)}
          className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
        {/* このボタンは送信しない（確認画面へ進む）。ラベルもそう名乗る。
            「投稿する」のままだと押した瞬間に投稿されると読めてしまう */}
        <button
          type="submit"
          disabled={compressing}
          className="px-6 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          確認する
        </button>
      </div>
    </form>
  );
}
