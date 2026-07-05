import { describe, it, expect } from "vitest";
import { sanitizeCoverImageUrl } from "@/utils/cover-image";

describe("sanitizeCoverImageUrl", () => {
  it("OpenBD の書影URLはそのまま通す", () => {
    expect(sanitizeCoverImageUrl("https://cover.openbd.jp/9784873116860.jpg")).toBe(
      "https://cover.openbd.jp/9784873116860.jpg"
    );
  });

  it("Google Books のサムネイルURLを通し、http は https に正規化する", () => {
    expect(
      sanitizeCoverImageUrl("http://books.google.com/books/content?id=abc&printsec=frontcover&img=1")
    ).toBe("https://books.google.com/books/content?id=abc&printsec=frontcover&img=1");
    expect(sanitizeCoverImageUrl("https://books.googleusercontent.com/books/content?id=abc")).toBe(
      "https://books.googleusercontent.com/books/content?id=abc"
    );
  });

  it("許可ホスト以外は null（第三者ホストの画像を保存させない）", () => {
    expect(sanitizeCoverImageUrl("https://evil.example/pixel.png")).toBeNull();
    // 許可ホスト名を含むだけの偽装（サブドメイン・クエリ）も弾く
    expect(sanitizeCoverImageUrl("https://books.google.com.evil.example/a.png")).toBeNull();
    expect(sanitizeCoverImageUrl("https://evil.example/?x=books.google.com")).toBeNull();
  });

  it("http/https 以外のスキームは null", () => {
    expect(sanitizeCoverImageUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeCoverImageUrl("data:image/gif;base64,R0lGOD")).toBeNull();
    expect(sanitizeCoverImageUrl("ftp://cover.openbd.jp/a.jpg")).toBeNull();
  });

  it("URLとして不正な文字列・空・未指定は null", () => {
    expect(sanitizeCoverImageUrl("not a url")).toBeNull();
    expect(sanitizeCoverImageUrl("")).toBeNull();
    expect(sanitizeCoverImageUrl(null)).toBeNull();
    expect(sanitizeCoverImageUrl(undefined)).toBeNull();
  });
});
