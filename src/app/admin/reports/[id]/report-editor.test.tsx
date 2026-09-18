import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminReportEditor } from "./report-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Server Action はネットワーク越しの呼び出しになるため、テストではモジュールごとモックする
vi.mock("@/features/report/actions/delete", () => ({
  deleteReport: vi.fn(),
  deleteReportImage: vi.fn(),
}));
vi.mock("@/features/report/actions/update", () => ({
  updateReport: vi.fn(),
}));

afterEach(cleanup);

function renderEditor(images: { id: string; imageUrl: string; addendumId: string | null }[]) {
  return render(
    <AdminReportEditor
      id="report-1"
      currentStatus="FORWARDED"
      currentStatusNote=""
      images={images}
    />
  );
}

describe("管理画面の添付画像", () => {
  // 一覧には追記の画像も混ざる（同じ投稿に属するため）。連絡後に足された画像は
  // 出版社が見た時点の証拠ではない＝どちらを消すのかで判断が変わる
  it("追記に添えた画像だけに印を出す", () => {
    renderEditor([
      { id: "img-body", imageUrl: "https://example.test/body.png", addendumId: null },
      { id: "img-addendum", imageUrl: "https://example.test/addendum.png", addendumId: "add-1" },
    ]);

    expect(screen.getAllByText("追記の画像")).toHaveLength(1);
  });

  it("本体の画像だけなら印は出ない", () => {
    renderEditor([{ id: "img-body", imageUrl: "https://example.test/body.png", addendumId: null }]);

    expect(screen.queryByText("追記の画像")).toBeNull();
  });
});
