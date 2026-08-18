import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NavLink } from "./nav-link";

// 現在地の判定（前方一致・境界の扱い）を固定する。見た目より先に aria-current が正しいことを担保する
// ＝スクリーンリーダーが「現在のページ」と読む部分で、目視では気づけないため。

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

afterEach(cleanup);

function renderAt(pathname: string, href: string) {
  pathnameMock.mockReturnValue(pathname);
  render(
    <NavLink href={href} className="base" activeClassName="bg-gray-800">
      投稿
    </NavLink>
  );
  return screen.getByRole("link", { name: "投稿" });
}

describe("NavLink", () => {
  it("そのページに居るとき現在地になる", () => {
    const link = renderAt("/admin/reports", "/admin/reports");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("詳細ページでも一覧が現在地のまま（前方一致）", () => {
    const link = renderAt("/admin/reports/abc-123", "/admin/reports");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("別のページでは現在地にしない", () => {
    const link = renderAt("/admin/books", "/admin/reports");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("前方一致は / 区切りで見る（似た名前のページに反応しない）", () => {
    const link = renderAt("/admin/reports-archive", "/admin/reports");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("現在地のときだけ見た目を足す（色だけに頼らず太字も付く）", () => {
    const active = renderAt("/admin/reports", "/admin/reports");
    expect(active.className).toContain("bg-gray-800");
    expect(active.className).toContain("font-medium");
    cleanup();

    const inactive = renderAt("/admin/books", "/admin/reports");
    expect(inactive.className).not.toContain("bg-gray-800");
    expect(inactive.className).not.toContain("font-medium");
  });
});
