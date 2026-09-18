import { z } from "zod";

/**
 * **外部の書誌サービス（OpenBD / Google Books）の応答を、このアプリの形に均す。**
 *
 * ⭐ **ここが zod の効く場所。** 内部の DTO（`db/` が返すもの）は自分のマッパーが作った値なので
 * 実行時に検証しても何も守れないが、**外部 API の応答は信用できない入力**で、形が変われば何の
 * 予告も無く壊れる。実際に壊れていた:
 *   - `api/books/openbd` と `api/books/search` は `await res.json()` をそのまま中継していた（実質 `any`）
 *   - 受け側は手書きの型を当てているだけで、`summary` の無い要素が来ると **TypeError**
 *
 * ⚠️ **`server-only` を付けない。** 型は client component も使う（ただし `parse*` を呼ぶのは route だけ）。
 * ⚠️ **DB も認可も持ち込まない。** ここは「外から来た JSON を確かめて均す」だけ。
 */

/** 画面が使う書誌1件。上流の違い（OpenBD / Google Books）はここで吸収する。 */
export type UpstreamBook = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  coverImageUrl: string;
  /** Google Books の候補を区別するためだけの値。OpenBD 由来なら空文字（保存もされない）。 */
  googleBooksId: string;
};

// Google Books の書影 URL は http で返ることがある。https のページから http 画像は
// 混在コンテンツとしてブラウザにブロックされるため、https に揃える（books.google.com は https 対応）。
const toHttpsUrl = (url: string | undefined): string => url?.replace("http://", "https://") ?? "";

// ──────────────────────────────── OpenBD ────────────────────────────────

// ⚠️ **上流に無い欄をここで必須にしない。** 書誌は欠けている項目が普通にあり、
//    厳しくすると「1冊だけ publisher が無い」ために検索全体が失敗する。
//    必須は isbn だけ（本の同一性の基準なので、無ければ選ばせられない = decision-isbn-required）。
const OpenBdEntrySchema = z
  .object({
    summary: z
      .object({
        isbn: z.string().optional(),
        title: z.string().optional(),
        author: z.string().optional(),
        publisher: z.string().optional(),
        cover: z.string().optional(),
      })
      .optional(),
  })
  // 見つからない ISBN の位置には null が入る（OpenBD は要求順を保つ）
  .nullable();

const OpenBdResponseSchema = z.array(OpenBdEntrySchema);

/**
 * OpenBD の応答を `UpstreamBook[]` に均す。**形が違えば例外を投げる**（呼び出し側が 502 に倒す）。
 * ⚠️ 「見つからない」と「上流が壊れている」は別物なので、ここで空配列に変換しないこと
 *    — 変換すると画面が「ISBN をご確認ください」＝利用者の入力ミスとして表示してしまう。
 */
export function parseOpenBdBooks(raw: unknown): UpstreamBook[] {
  return OpenBdResponseSchema.parse(raw).flatMap((entry) => {
    const summary = entry?.summary;
    if (!summary?.isbn) return [];
    return [
      {
        isbn: summary.isbn,
        title: summary.title ?? "",
        author: summary.author ?? "",
        publisher: summary.publisher ?? "",
        coverImageUrl: toHttpsUrl(summary.cover),
        googleBooksId: "",
      },
    ];
  });
}

// ───────────────────────────── Google Books ─────────────────────────────

const GoogleBooksResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        volumeInfo: z.object({
          title: z.string().optional(),
          authors: z.array(z.string()).optional(),
          publisher: z.string().optional(),
          imageLinks: z.object({ thumbnail: z.string().optional() }).optional(),
          industryIdentifiers: z
            .array(z.object({ type: z.string(), identifier: z.string() }))
            .optional(),
        }),
      })
    )
    .optional(),
});

/**
 * Google Books の応答を `UpstreamBook[]` に均す。**形が違えば例外を投げる**。
 * ⚠️ ISBN の無い候補は落とす（ISBN を本の同一性の基準にしているので、選ばせても投稿できない）。
 */
export function parseGoogleBooks(raw: unknown): UpstreamBook[] {
  const { items = [] } = GoogleBooksResponseSchema.parse(raw);

  return items.flatMap((item) => {
    const info = item.volumeInfo;
    const ids = info.industryIdentifiers ?? [];
    const isbn =
      ids.find((id) => id.type === "ISBN_13")?.identifier ??
      ids.find((id) => id.type === "ISBN_10")?.identifier ??
      "";
    if (!isbn) return [];

    return [
      {
        isbn,
        title: info.title ?? "",
        author: (info.authors ?? []).join(", "),
        publisher: info.publisher ?? "",
        coverImageUrl: toHttpsUrl(info.imageLinks?.thumbnail),
        googleBooksId: item.id,
      },
    ];
  });
}
