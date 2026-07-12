import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { UpvoteButton } from "./upvote-button";
import { routes } from "@/constants/routes";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UpvoteButton", () => {
  it("未ログイン（guest）はクリックで /login へ誘導し API を呼ばない", () => {
    render(<UpvoteButton reportId="r1" initialCount={0} initialUpvoted={false} viewer="guest" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledWith(routes.login);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("投稿者本人（owner）はボタンが無効", () => {
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="owner" type="ERRATA" />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("自分の投稿には賛同できません");
  });

  it("未賛同の user がクリックすると POST され、レスポンスの count に更新される", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ upvoted: true, count: 3 }),
    });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(routes.api.reportUpvote("r1"), { method: "POST" });
  });

  it("賛同済みの user がクリックすると DELETE され、取り消しの count に更新される", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ upvoted: false, count: 1 }),
    });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={true} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(routes.api.reportUpvote("r1"), { method: "DELETE" });
  });

  it("API が失敗（!ok）したら表示を変えない", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<UpvoteButton reportId="r1" initialCount={2} initialUpvoted={false} viewer="user" type="ERRATA" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText("2")).toBeTruthy();
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
