import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NumberField } from "./number-field";
import { numberFieldError } from "@/components/report-fields";

// このリポジトリの vitest は globals を有効にしていないので自動 cleanup が効かない
// （= 描画が積み上がり getBy* が「複数見つかった」で落ちる。user-editor.test.tsx と同じ扱い）
afterEach(cleanup);

// NumberField は <input type="number"> の代わりに使う欄。ネイティブから引き継ぐ挙動
// （▲▼と↑↓での増減）と、置き換えた理由そのもの（全角の変換）をここで固定する。

function setup(value = "") {
  const onChange = vi.fn();
  render(<NumberField id="page" value={value} onChange={onChange} placeholder="例: 58" />);
  return { onChange, input: screen.getByPlaceholderText("例: 58") };
}

describe("NumberField", () => {
  it("フォーカスを外すと全角数字が半角になる", () => {
    const { onChange, input } = setup("１４１");
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("141");
  });

  it("既に半角なら値を書き換えない（不要な再描画を起こさない）", () => {
    const { onChange, input } = setup("141");
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("↑↓キーで増減する", () => {
    const { onChange, input } = setup("41");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("42");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("40");
  });

  it("未入力から増やすと下限（1）から始まる", () => {
    const { onChange, input } = setup("");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("下限より小さくならない", () => {
    const { onChange, input } = setup("1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("▲▼ボタンでも増減する", () => {
    const { onChange } = setup("5");
    fireEvent.click(screen.getByTitle("1増やす"));
    expect(onChange).toHaveBeenCalledWith("6");
    fireEvent.click(screen.getByTitle("1減らす"));
    expect(onChange).toHaveBeenCalledWith("4");
  });

  it("スマホで数字キーパッドが出る指定になっている", () => {
    const { input } = setup("");
    // jest-dom は導入していないので属性を直接見る
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });
});

describe("numberFieldError", () => {
  it("必須の欄が未入力ならエラー", () => {
    expect(numberFieldError("ページ番号", "", true)).toBe("ページ番号を入力してください");
  });

  it("任意の欄は未入力でもエラーにしない", () => {
    expect(numberFieldError("行番号", "", false)).toBeNull();
  });

  it("全角で入っていてもエラーにしない（送信前に半角として読むため）", () => {
    expect(numberFieldError("ページ番号", "１４１", true)).toBeNull();
  });

  it("数字として読めない入力・0以下はエラー", () => {
    const message = "ページ番号は半角数字（1以上の整数）で入力してください";
    expect(numberFieldError("ページ番号", "42ページ", true)).toBe(message);
    expect(numberFieldError("ページ番号", "0", true)).toBe(message);
    expect(numberFieldError("ページ番号", "-3", true)).toBe(message);
  });
});
