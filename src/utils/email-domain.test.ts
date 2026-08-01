import { describe, it, expect } from "vitest";
import { normalizeEmailDomain, isValidEmailDomain, isFreeMailDomain } from "./email-domain";

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

describe("isFreeMailDomain", () => {
  // これを通すと**そのサービスの利用者全員**に出版社アクセスが付く。
  // 形としては正しいドメインなので isValidEmailDomain では落ちない＝名指しで弾く必要がある。
  it.each(["gmail.com", "yahoo.co.jp", "outlook.com", "hotmail.co.jp", "icloud.com"])(
    "主要なフリーメールは弾く: %s",
    (value) => {
      expect(isFreeMailDomain(value)).toBe(true);
      expect(isValidEmailDomain(value)).toBe(true); // 形の検証では落ちないことも固定する
    }
  );

  it.each(["example.co.jp", "oreilly.co.jp", "", "gmail.com.example.jp"])(
    "企業ドメインは通す: %s",
    (value) => {
      expect(isFreeMailDomain(value)).toBe(false);
    }
  );

  it("正規化を通した後の値で判定する（大文字・空白は呼び出し側で落とす前提）", () => {
    expect(isFreeMailDomain(normalizeEmailDomain("  GMAIL.com "))).toBe(true);
  });
});
