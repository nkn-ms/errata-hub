import { describe, it, expect } from "vitest";
import { normalizeEmailDomain, isValidEmailDomain } from "./email-domain";

// この値は**アクセス権を付与する条件**（一致した出版社の PublisherAccess が自動で付く）なので、
// 「無言で効かなくなる入力」を確実に弾けることを固定する。

describe("normalizeEmailDomain", () => {
  it("前後の空白を落とし、小文字に寄せる", () => {
    expect(normalizeEmailDomain("  Example.CO.JP  ")).toBe("example.co.jp");
  });

  it("空文字はそのまま（未設定を表す）", () => {
    expect(normalizeEmailDomain("   ")).toBe("");
  });
});

describe("isValidEmailDomain", () => {
  it.each(["example.com", "example.co.jp", "sub.example.com", "a-b.example.com", "x1.co"])(
    "ドメインの形なら通す: %s",
    (value) => {
      expect(isValidEmailDomain(value)).toBe(true);
    }
  );

  // 弾けないと「設定したのに権限が付かない」が無言で起きる入力たち
  it.each([
    "@example.com", // メールアドレスの一部を貼った
    "https://example.com", // URL を貼った
    "user@example.com", // メールアドレスそのもの
    "localhost", // 単一ラベル
    "example.com/path", // パス付き
    "-example.com", // ラベルがハイフンで始まる
    "example-.com", // ラベルがハイフンで終わる
    "example .com", // 途中に空白
  ])("ドメインの形でなければ弾く: %s", (value) => {
    expect(isValidEmailDomain(value)).toBe(false);
  });
});
