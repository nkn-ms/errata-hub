import { describe, it, expect } from "vitest";
import { sanitizeExternalUrl, hostnameOf } from "./external-url";

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

  it("http は通さない（中間者による書き換えを防ぐ）", () => {
    expect(sanitizeExternalUrl("http://example.com/errata")).toBeNull();
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

describe("hostnameOf", () => {
  it("ホスト名だけを返す", () => {
    expect(hostnameOf("https://www.oreilly.co.jp/books/errata/")).toBe("www.oreilly.co.jp");
  });

  it("URL でなければそのまま返す（表示用のフォールバック）", () => {
    expect(hostnameOf("not a url")).toBe("not a url");
  });
});
