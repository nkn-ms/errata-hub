import { describe, it, expect } from "vitest";
import { paginate } from "./pagination";

describe("paginate", () => {
  it("端数は切り上げて総ページ数にする", () => {
    expect(paginate(1, 100, 50).totalPages).toBe(2);
    expect(paginate(1, 101, 50).totalPages).toBe(3);
  });

  it("0件でも1ページ（0ページ目は存在しない）", () => {
    expect(paginate(1, 0, 50).totalPages).toBe(1);
  });

  it("件数があるのに範囲外のページ番号は「寄せる」と判定する", () => {
    expect(paginate(3, 100, 50).isOutOfRange).toBe(true);
    expect(paginate(2, 100, 50).isOutOfRange).toBe(false);
  });

  // 0件のときに寄せてしまうと、本当に「まだありません」を見せたい画面へ辿り着けなくなる
  it("0件のときは範囲外と判定しない（寄せる先が無いため）", () => {
    expect(paginate(5, 0, 50).isOutOfRange).toBe(false);
  });

  it("「何件目から何件目」を1始まりで返す", () => {
    expect(paginate(1, 240, 50)).toMatchObject({ from: 1, to: 50 });
    expect(paginate(2, 240, 50)).toMatchObject({ from: 51, to: 100 });
  });

  it("最終ページの to は総件数で止める（端数のページで水増ししない）", () => {
    expect(paginate(5, 240, 50)).toMatchObject({ from: 201, to: 240 });
  });

  it("0件のときは to が from を下回る（表示側は総ページ数1で出さない）", () => {
    expect(paginate(1, 0, 50)).toMatchObject({ from: 1, to: 0 });
  });
});
