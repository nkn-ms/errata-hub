import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { BookSearch } from "./book-search";

// 日本語入力の変換中に検索が飛ぶかどうかだけを見る。上流の応答は空で足りる
const fetchMock = vi.fn(
  async (_url: RequestInfo | URL) => new Response(JSON.stringify({ books: [] }), { status: 200 })
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderSearch() {
  render(
    <>
      <span id="book-label">書籍名</span>
      <BookSearch onSelect={vi.fn()} labelledBy="book-label" />
    </>
  );
  // 既定は ISBN 検索なので、タイトル検索へ切り替えてから触る
  fireEvent.click(screen.getByRole("button", { name: "タイトルで検索" }));
  return screen.getByPlaceholderText("書籍名・著者名で検索...");
}

// React は onChange を native の `input` イベントで拾う。「変換中か」は そのイベントの
// isComposing に乗っているので、fireEvent.change（合成の change）では再現できない。
// 値の書き込みに native の setter を使うのは、React の値トラッカーを通すため
// （input.value = ... だけだと「変わっていない」と見なされて onChange が出ない）。
const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

function typeWhileComposing(input: HTMLElement, value: string) {
  setInputValue.call(input, value);
  fireEvent(input, new InputEvent("input", { bubbles: true, isComposing: true }));
}

/** デバウンス（400ms）を明け、その後に走る非同期処理も流す */
async function passDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("書籍のタイトル検索", () => {
  it("変換の確定前は検索しない（文字は入力欄に出る）", async () => {
    const input = renderSearch();

    typeWhileComposing(input, "うぇb");
    await passDebounce();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("うぇb");
  });

  it("確定したら検索する", async () => {
    const input = renderSearch();

    typeWhileComposing(input, "ウェブ");
    fireEvent.compositionEnd(input);
    await passDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent("ウェブ"));
  });

  it("変換を挟まない入力はこれまでどおり検索する", async () => {
    const input = renderSearch();

    fireEvent.change(input, { target: { value: "web" } });
    await passDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
