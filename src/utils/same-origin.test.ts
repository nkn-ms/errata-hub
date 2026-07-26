import { describe, it, expect } from "vitest";
import { isSameOrigin, isSameOriginRequest } from "./same-origin";

describe("isSameOrigin", () => {
  it("同じホストなら通す", () => {
    expect(isSameOrigin("https://errata-hub.example", "errata-hub.example")).toBe(true);
  });

  it("別ホストは拒否する（これが CSRF 対策の本体）", () => {
    expect(isSameOrigin("https://evil.example", "errata-hub.example")).toBe(false);
  });

  it("接頭辞が一致するだけの別ドメインは拒否する", () => {
    expect(isSameOrigin("https://errata-hub.example.evil.test", "errata-hub.example")).toBe(false);
  });

  it("ポートが違えば別オリジン（localhost の開発時に効く）", () => {
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isSameOrigin("http://localhost:4000", "localhost:3000")).toBe(false);
  });

  it("Origin が無いリクエストは拒否する（ブラウザは POST に必ず付ける）", () => {
    expect(isSameOrigin(null, "errata-hub.example")).toBe(false);
  });

  it("Host が無いリクエストは拒否する", () => {
    expect(isSameOrigin("https://errata-hub.example", null)).toBe(false);
  });

  it("Origin が URL として壊れていても例外にせず拒否する", () => {
    expect(isSameOrigin("null", "errata-hub.example")).toBe(false);
    expect(isSameOrigin("not a url", "errata-hub.example")).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  it("x-forwarded-host を host より優先する（Vercel のプロキシ背後で必要）", () => {
    const headers = new Headers({
      origin: "https://errata-hub.example",
      host: "internal-lambda.vercel.internal",
      "x-forwarded-host": "errata-hub.example",
    });
    expect(isSameOriginRequest(headers)).toBe(true);
  });

  it("x-forwarded-host が無ければ host を見る", () => {
    const headers = new Headers({
      origin: "https://errata-hub.example",
      host: "errata-hub.example",
    });
    expect(isSameOriginRequest(headers)).toBe(true);
  });

  it("ヘッダが揃っていても別オリジンなら拒否する", () => {
    const headers = new Headers({
      origin: "https://evil.example",
      host: "errata-hub.example",
    });
    expect(isSameOriginRequest(headers)).toBe(false);
  });
});
