import { describe, it, expect } from "vitest";
import { routes } from "@/constants/routes";

describe("routes", () => {
  it("静的なトップレベルのパスが期待どおり", () => {
    expect(routes.home).toBe("/");
    expect(routes.login).toBe("/login");
    expect(routes.register).toBe("/register");
    expect(routes.submit).toBe("/submit");
    expect(routes.reports).toBe("/reports");
    expect(routes.howToUse).toBe("/how-to-use");
    expect(routes.tech).toBe("/tech");
  });

  it("パラメータ付きルートは id を埋め込んだパスを返す", () => {
    expect(routes.report("abc")).toBe("/reports/abc");
    // 書籍だけ UUID でなく ISBN を埋める（公開 URL を自然キーに寄せる）
    expect(routes.book("9784873115658")).toBe("/books/9784873115658");
    expect(routes.user("u1")).toBe("/users/u1");
    // 「この本に投稿する」の導線。素の /submit と同じページを ISBN 付きで開く
    expect(routes.submitForBook("9784873116860")).toBe("/submit?isbn=9784873116860");
  });

  it("auth 配下のパスが期待どおり", () => {
    expect(routes.auth.confirm).toBe("/auth/confirm");
    expect(routes.auth.error).toBe("/auth/error");
    expect(routes.auth.verified).toBe("/auth/verified");
  });

  it("admin 配下の静的パスが期待どおり", () => {
    expect(routes.admin.reports).toBe("/admin/reports");
    expect(routes.admin.publishers).toBe("/admin/publishers");
    expect(routes.admin.publisherNew).toBe("/admin/publishers/new");
    expect(routes.admin.users).toBe("/admin/users");
    expect(routes.admin.logs).toBe("/admin/logs");
  });

  it("admin 配下のパラメータ付きルートは id を埋め込む", () => {
    expect(routes.admin.report("r1")).toBe("/admin/reports/r1");
    expect(routes.admin.publisher("p1")).toBe("/admin/publishers/p1");
    expect(routes.admin.user("u1")).toBe("/admin/users/u1");
  });

  it("api 配下のパスが期待どおり", () => {
    expect(routes.api.reportImages("r1")).toBe("/api/reports/r1/images");
    expect(routes.api.booksSearch).toBe("/api/books/search");
    expect(routes.api.booksOpenbd).toBe("/api/books/openbd");
  });

  it("パラメータ付きルートは対応する一覧パスの配下になる", () => {
    // 詳細ページの URL は一覧ページの URL を接頭辞に持つ（リネーム時の整合性確認）
    expect(routes.report("r1").startsWith(routes.reports)).toBe(true);
    expect(routes.admin.report("r1").startsWith(routes.admin.reports)).toBe(true);
    expect(routes.admin.user("u1").startsWith(routes.admin.users)).toBe(true);
  });
});
