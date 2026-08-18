import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorContent } from "./error-content";

// 例外画面で守りたいのは3つ:
//   ① 再試行が押せて、押すと回復処理（unstable_retry）が呼ばれる
//   ② 戻り先を呼び出し側から差し替えられる（公開側＝トップ／管理画面＝投稿一覧）
//   ③ digest があるときだけ識別子と問い合わせ案内を出す
// e2e では例外をわざと起こす必要があり、そのためだけに落ちるルートを本番へ置くことになるので、
// ここは単体テストで固定する。
// jest-dom は導入していないので属性・存在は直接見る。

afterEach(cleanup);

describe("ErrorContent", () => {
  it("再試行を押すと回復処理が呼ばれる", () => {
    const onRetry = vi.fn();
    render(<ErrorContent onRetry={onRetry} action={{ href: "/", label: "トップへ" }} />);

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("戻り先のリンクを呼び出し側から差し替えられる", () => {
    render(
      <ErrorContent onRetry={vi.fn()} action={{ href: "/admin/reports", label: "投稿一覧へ" }} />
    );

    expect(screen.getByRole("link", { name: "投稿一覧へ" }).getAttribute("href")).toBe(
      "/admin/reports"
    );
  });

  it("digest があれば識別子として表示する", () => {
    render(
      <ErrorContent
        digest="abc123def"
        onRetry={vi.fn()}
        action={{ href: "/", label: "トップへ" }}
      />
    );

    expect(screen.getByText("abc123def")).toBeTruthy();
  });

  it("digest が無いときは問い合わせの案内ごと出さない", () => {
    render(<ErrorContent onRetry={vi.fn()} action={{ href: "/", label: "トップへ" }} />);

    // 識別子を伝えられない状況で問い合わせだけ促しても、受け取る側が特定できない
    expect(screen.queryByText(/ご連絡ください/)).toBeNull();
  });
});
