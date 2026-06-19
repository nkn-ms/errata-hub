import { describe, it, expect } from "vitest";
import { toCanonicalIsbn } from "@/utils/isbn";

describe("toCanonicalIsbn", () => {
  it("正しい ISBN-13 はそのまま返す", () => {
    // チェック数字が正しい ISBN-13
    expect(toCanonicalIsbn("9784274217883")).toBe("9784274217883");
    expect(toCanonicalIsbn("9784873119045")).toBe("9784873119045");
  });

  it("ISBN-10 を ISBN-13 へ変換する", () => {
    // 4-87311-336-9 (ISBN-10) ↔ 978-4-87311-336-4 (ISBN-13) は同じ本
    expect(toCanonicalIsbn("4873113369")).toBe("9784873113364");
  });

  it("末尾が X の ISBN-10 を変換する", () => {
    // 0-8044-2957-X（チェック数字 X = 10）
    expect(toCanonicalIsbn("080442957X")).toBe("9780804429573");
  });

  it("ハイフン・空白などの区切り文字を除去して処理する", () => {
    expect(toCanonicalIsbn("978-4-87311-904-5")).toBe("9784873119045");
    expect(toCanonicalIsbn("4 87311 336 9")).toBe("9784873113364");
  });

  it("末尾 x（小文字）も大文字 X として扱う", () => {
    expect(toCanonicalIsbn("080442957x")).toBe("9780804429573");
  });

  it("同じ本の ISBN-10 と ISBN-13 は同じ正規形に名寄せされる", () => {
    const from10 = toCanonicalIsbn("4873113369");
    const from13 = toCanonicalIsbn("9784873113364");
    expect(from10).toBe(from13);
  });

  it("チェック数字が不正な ISBN-13 は null を返す", () => {
    // 正しくは末尾 3。改ざんした 5 は検算に通らない
    expect(toCanonicalIsbn("9784274217885")).toBeNull();
  });

  it("チェック数字が不正な ISBN-10 は null を返す", () => {
    // 末尾を 9→0 に改ざん
    expect(toCanonicalIsbn("4873113360")).toBeNull();
  });

  it("桁数が 10/13 以外のものは null を返す", () => {
    expect(toCanonicalIsbn("")).toBeNull();
    expect(toCanonicalIsbn("123")).toBeNull();
    expect(toCanonicalIsbn("12345678901")).toBeNull(); // 11桁
    expect(toCanonicalIsbn("123456789012")).toBeNull(); // 12桁
    expect(toCanonicalIsbn("12345678901234")).toBeNull(); // 14桁
  });

  it("数字でない文字だけの入力は null を返す", () => {
    expect(toCanonicalIsbn("abcdefghij")).toBeNull();
  });

  it("X が末尾以外に現れる ISBN-10 は不正として null を返す", () => {
    // X は ISBN-10 のチェック数字（末尾）にのみ許される
    expect(toCanonicalIsbn("X873113369")).toBeNull();
    expect(toCanonicalIsbn("48731133X9")).toBeNull();
  });
});
