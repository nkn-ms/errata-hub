import { describe, it, expect } from "vitest";
import { parseOpenBdBooks, parseGoogleBooks } from "./upstream";

describe("parseOpenBdBooks", () => {
  it("summary が無い要素を落とす（**これが実際に TypeError になっていた経路**）", () => {
    // OpenBD の型宣言自体が summary を省略可としているのに、ISBN 直接検索の画面は
    // data[0].summary.title を直読みしていた。ここで落とすので呼び出し側は壊れない
    expect(parseOpenBdBooks([{}])).toEqual([]);
  });

  it("見つからない ISBN の位置に入る null を落とす", () => {
    expect(parseOpenBdBooks([null])).toEqual([]);
  });

  it("isbn の無い書誌は落とす（ISBN が本の同一性の基準なので選ばせられない）", () => {
    expect(parseOpenBdBooks([{ summary: { title: "ISBN の無い本" } }])).toEqual([]);
  });

  it("欠けている欄は空文字に均す（1冊の欠落で検索全体を失敗させない）", () => {
    expect(parseOpenBdBooks([{ summary: { isbn: "9784000000000", title: "テスト書籍" } }])).toEqual([
      {
        isbn: "9784000000000",
        title: "テスト書籍",
        author: "",
        publisher: "",
        coverImageUrl: "",
        googleBooksId: "",
      },
    ]);
  });

  it("上流の形が違えば投げる（呼び出し側が 502 に倒す。空配列に潰さない）", () => {
    // 空配列にすると「その ISBN の本が無い」と区別が付かず、
    // 画面が「ISBN をご確認ください」＝利用者の入力ミスとして表示してしまう
    expect(() => parseOpenBdBooks({ unexpected: true })).toThrow();
    expect(() => parseOpenBdBooks([{ summary: { isbn: 9784000000000 } }])).toThrow();
  });
});

describe("parseGoogleBooks", () => {
  const item = (volumeInfo: Record<string, unknown>) => ({ items: [{ id: "vol-1", volumeInfo }] });

  it("ISBN-13 を優先して取り出す", () => {
    const [book] = parseGoogleBooks(
      item({
        title: "テスト書籍",
        authors: ["著者A", "著者B"],
        publisher: "テスト出版社",
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "4000000000" },
          { type: "ISBN_13", identifier: "9784000000000" },
        ],
      })
    );

    expect(book).toEqual({
      isbn: "9784000000000",
      title: "テスト書籍",
      author: "著者A, 著者B",
      publisher: "テスト出版社",
      coverImageUrl: "",
      googleBooksId: "vol-1",
    });
  });

  it("ISBN の無い候補は落とす", () => {
    expect(parseGoogleBooks(item({ title: "ISBN の無い本" }))).toEqual([]);
  });

  it("書影の http を https に揃える（混在コンテンツでブロックされるため）", () => {
    const [book] = parseGoogleBooks(
      item({
        imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
        industryIdentifiers: [{ type: "ISBN_13", identifier: "9784000000000" }],
      })
    );

    expect(book.coverImageUrl).toBe("https://books.google.com/cover.jpg");
  });

  it("items が無い応答は候補ゼロ（「該当なし」であって失敗ではない）", () => {
    expect(parseGoogleBooks({})).toEqual([]);
  });

  it("上流の形が違えば投げる", () => {
    expect(() => parseGoogleBooks({ items: [{ id: "vol-1" }] })).toThrow();
  });
});
