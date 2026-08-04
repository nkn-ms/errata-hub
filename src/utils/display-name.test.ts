import { describe, it, expect } from "vitest";
import { toDisplayName } from "./display-name";
import { PROFILE_LIMITS } from "@/constants/profile-limits";

describe("toDisplayName（auth/callback で user_metadata を表示名にする）", () => {
  it("普通の文字列はそのまま通る", () => {
    expect(toDisplayName("なかの")).toBe("なかの");
  });

  it("前後の空白は落とす", () => {
    expect(toDisplayName("  なかの  ")).toBe("なかの");
  });

  it("空文字・空白だけは null（呼び出し側の次の候補へ送るため）", () => {
    expect(toDisplayName("")).toBeNull();
    expect(toDisplayName("   ")).toBeNull();
  });

  // ⚠️ ここが本題。register / updateDisplayName は zod で弾けるが、callback は
  // OAuth の途中なので弾けない（エラーにするとログインが壊れる）＝切り詰めで守る
  it("上限を超えたら切り詰める（弾かない）", () => {
    const long = "あ".repeat(PROFILE_LIMITS.displayName + 10);

    const result = toDisplayName(long);

    expect(result).toHaveLength(PROFILE_LIMITS.displayName);
  });

  it("上限ちょうどは切り詰めない", () => {
    const exact = "あ".repeat(PROFILE_LIMITS.displayName);

    expect(toDisplayName(exact)).toBe(exact);
  });

  // user_metadata は任意の JSON なので、文字列以外が入り得る（`as string` は嘘になる）
  it("文字列でない値は null", () => {
    expect(toDisplayName(undefined)).toBeNull();
    expect(toDisplayName(null)).toBeNull();
    expect(toDisplayName(123)).toBeNull();
    expect(toDisplayName({ name: "なかの" })).toBeNull();
    expect(toDisplayName(["なかの"])).toBeNull();
  });
});
