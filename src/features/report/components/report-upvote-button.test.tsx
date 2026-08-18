import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { UpvoteButton } from "./report-upvote-button";
import { routes } from "@/constants/routes";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Server Action はネットワーク越しの呼び出しになるため、テストではモジュールごとモックする
const toggleUpvoteMock = vi.fn();
vi.mock("@/features/report/actions/report", () => ({
  toggleUpvote: (...args: unknown[]) => toggleUpvoteMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("UpvoteButton", () => {
  it("未ログイン（guest）はクリックで /login へ誘導しアクションを呼ばない", () => {
    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="guest" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledWith(routes.login);
    expect(toggleUpvoteMock).not.toHaveBeenCalled();
  });

  it("投稿者本人（owner）はボタンが無効", () => {
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="owner" type="ERRATA" />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("自分の投稿には賛同できません");
  });

  it("未賛同の user がクリックすると賛同が付き、戻り値の count に更新される", async () => {
    toggleUpvoteMock.mockResolvedValue({ upvoted: true, count: 3 });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    expect(toggleUpvoteMock).toHaveBeenCalledWith("r1", true);
  });

  it("賛同済みの user がクリックすると取り消され、戻り値の count に更新される", async () => {
    toggleUpvoteMock.mockResolvedValue({ upvoted: false, count: 1 });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={true} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
    expect(toggleUpvoteMock).toHaveBeenCalledWith("r1", false);
  });

  it("アクションが失敗（error）を返したら表示を変えない", async () => {
    toggleUpvoteMock.mockResolvedValue({ error: "賛同に失敗しました" });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toggleUpvoteMock).toHaveBeenCalled());
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("賛同状態は aria-pressed で支援技術に伝わり、クリックで切り替わる", async () => {
    toggleUpvoteMock.mockResolvedValue({ upvoted: true, count: 3 });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="user" type="ERRATA" />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
  });

  it("未ログイン（guest）は賛同状態を持たないので aria-pressed を付けない", () => {
    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="guest" type="ERRATA" />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBeNull();
  });

  it("ボタン文言は種別で切り替わる（正誤情報=自分も見つけた / 提案・その他=私もそう思う）", () => {
    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="user" type="ERRATA" />);
    expect(screen.getByText("自分も見つけた")).toBeTruthy();
    cleanup();

    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="user" type="SUGGESTION" />);
    expect(screen.getByText("私もそう思う")).toBeTruthy();
    cleanup();

    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="user" type="OTHER" />);
    expect(screen.getByText("私もそう思う")).toBeTruthy();
  });
});
