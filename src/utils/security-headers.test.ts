import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/utils/security-headers";

/** ディレクティブ名から値を取り出す（"script-src 'self' …" → "'self' …"） */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d === name || d.startsWith(`${name} `))
    ?.slice(name.length)
    .trim();
}

const PROD = {
  nonce: "dGVzdC1ub25jZQ==",
  isDev: false,
  supabaseUrl: "https://example.supabase.co",
  allowVercelToolbar: false,
};

describe("buildContentSecurityPolicy", () => {
  it("script-src は nonce と strict-dynamic で組む（本番は unsafe-eval なし）", () => {
    const scriptSrc = directive(buildContentSecurityPolicy(PROD), "script-src");
    expect(scriptSrc).toBe("'self' 'nonce-dGVzdC1ub25jZQ==' 'strict-dynamic'");
  });

  it("script-src に unsafe-inline を入れない（入れると nonce 方式が無意味になる）", () => {
    for (const isDev of [true, false]) {
      const scriptSrc = directive(buildContentSecurityPolicy({ ...PROD, isDev }), "script-src");
      expect(scriptSrc).not.toContain("unsafe-inline");
    }
  });

  it("dev だけ unsafe-eval と ws: を足す（React の eval と HMR のため）", () => {
    const dev = buildContentSecurityPolicy({ ...PROD, isDev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
  });

  it("upgrade-insecure-requests は本番だけ（ローカルの Supabase は http なので）", () => {
    expect(buildContentSecurityPolicy(PROD)).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ ...PROD, isDev: true })).not.toContain(
      "upgrade-insecure-requests"
    );
  });

  it("img-src に書影の許可ホストと Supabase のオリジンが入る", () => {
    const imgSrc = directive(buildContentSecurityPolicy(PROD), "img-src");
    expect(imgSrc).toContain("https://cover.openbd.jp");
    expect(imgSrc).toContain("https://books.google.com");
    expect(imgSrc).toContain("https://books.googleusercontent.com");
    // 投稿画像（Supabase Storage の公開URL）。パスは含めずオリジンだけにする
    expect(imgSrc).toContain("https://example.supabase.co");
    // 選択中ファイルのプレビュー（blob:）が読めること
    expect(imgSrc).toContain("blob:");
  });

  it("Supabase の URL が壊れている／未設定でも組み立てに失敗しない", () => {
    for (const supabaseUrl of [undefined, "", "not a url"]) {
      const csp = buildContentSecurityPolicy({ ...PROD, supabaseUrl });
      expect(directive(csp, "connect-src")).toBe("'self'");
      expect(directive(csp, "img-src")).not.toContain("undefined");
    }
  });

  it("Vercel Toolbar は Preview だけ通す（本番の frame-src は none のまま）", () => {
    const prod = buildContentSecurityPolicy(PROD);
    expect(directive(prod, "frame-src")).toBe("'none'");
    expect(prod).not.toContain("vercel.live");

    // Preview: iframe とコメントの WebSocket が通り、それ以外の指定は変わらない
    const preview = buildContentSecurityPolicy({ ...PROD, allowVercelToolbar: true });
    expect(directive(preview, "frame-src")).toBe("https://vercel.live");
    expect(directive(preview, "connect-src")).toContain("wss://ws-us3.pusher.com");
    expect(directive(preview, "script-src")).toBe(directive(prod, "script-src"));
    expect(directive(preview, "form-action")).toBe("'self'");
  });

  it("埋め込み・注入の足場になるディレクティブを閉じている", () => {
    const csp = buildContentSecurityPolicy(PROD);
    expect(directive(csp, "default-src")).toBe("'self'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "frame-src")).toBe("'none'");
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "form-action")).toBe("'self'");
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("HSTS は含めない（Vercel が既に付けており、弱い値で上書きしないため）", () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key.toLowerCase());
    expect(keys).not.toContain("strict-transport-security");
  });

  it("キーが重複していない", () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
