import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminAddendumList } from "./addendum-list";

// Server Action はネットワーク越しの呼び出しになるため、テストではモジュールごとモックする
vi.mock("@/features/report/actions/delete", () => ({
  deleteReportAddendum: vi.fn(),
}));

afterEach(cleanup);

const addendum = {
  id: "11111111-2222-4333-8444-555555555555",
  body: "第3刷では直っていました",
  createdAt: "2026-09-19 10:00",
  images: [],
};

describe("管理画面の追記一覧", () => {
  // 管理者が DB で1件を引くための値なので、縮めて出すと同定に使えない
  it("id を省略せずに出す", () => {
    render(<AdminAddendumList addenda={[addendum]} />);

    expect(screen.getByText(addendum.id)).toBeDefined();
  });

  it("追記が無ければ id の行ごと出ない", () => {
    render(<AdminAddendumList addenda={[]} />);

    expect(screen.queryByText(addendum.id)).toBeNull();
    expect(screen.getByText("まだ追記はありません。")).toBeDefined();
  });
});
