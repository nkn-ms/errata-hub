import { describe, it, expect } from "vitest";
import { sanitizeExternalUrl, hostnameOf, isInsecureUrl } from "./external-url";

describe("sanitizeExternalUrl", () => {
  it("https の URL はそのまま通す", () => {
    expect(sanitizeExternalUrl("https://www.oreilly.co.jp/books/errata/")).toBe(
      "https://www.oreilly.co.jp/books/errata/"
    );
  });

  it("空・null・空白のみは null", () => {
    expect(sanitizeExternalUrl("")).toBeNull();
    expect(sanitizeExternalUrl(null)).toBeNull();
    expect(sanitizeExternalUrl("   ")).toBeNull();
  });

  // 出版社の正誤表が http のまま置かれていることが実際にあり、弾くと正誤表への導線を失う。
  // 中間者に書き換えられうる点は isInsecureUrl() で表示側に注記を出して開示する。
  it("http の URL も通す（表示側で注記を出す前提）", () => {
    expect(sanitizeExternalUrl("http://example.com/errata")).toBe("http://example.com/errata");
  });

  it("javascript: / data: スキームは通さない", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("ユーザー名・パスワード入りの URL は通さない（表示ホストの偽装に使われる）", () => {
    expect(sanitizeExternalUrl("https://www.oreilly.co.jp@evil.example/errata")).toBeNull();
    expect(sanitizeExternalUrl("https://user:pass@example.com/")).toBeNull();
  });

  it("URL として壊れているものは null", () => {
    expect(sanitizeExternalUrl("これはURLではない")).toBeNull();
    expect(sanitizeExternalUrl("www.example.com/errata")).toBeNull(); // スキームなし
  });
});

describe("isInsecureUrl", () => {
  it("http は true・https は false", () => {
    expect(isInsecureUrl("http://example.com/errata")).toBe(true);
    expect(isInsecureUrl("https://example.com/errata")).toBe(false);
  });

  it("URL として壊れているものは false（注記を出さない側に倒す）", () => {
    expect(isInsecureUrl("これはURLではない")).toBe(false);
  });
});

describe("hostnameOf", () => {
  it("ホスト名だけを返す", () => {
    expect(hostnameOf("https://www.oreilly.co.jp/books/errata/")).toBe("www.oreilly.co.jp");
  });

  it("URL でなければそのまま返す（表示用のフォールバック）", () => {
    expect(hostnameOf("not a url")).toBe("not a url");
  });
});
