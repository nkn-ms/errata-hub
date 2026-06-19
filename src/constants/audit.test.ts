import { describe, it, expect } from "vitest";
import { TARGET_TYPE } from "@/constants/audit";

describe("TARGET_TYPE", () => {
  it("各キーは Prisma モデル名と一致する文字列を持つ", () => {
    expect(TARGET_TYPE.REPORT).toBe("Report");
    expect(TARGET_TYPE.PROFILE).toBe("Profile");
    expect(TARGET_TYPE.PUBLISHER_ACCESS).toBe("PublisherAccess");
  });

  it("値に重複がない", () => {
    const values = Object.values(TARGET_TYPE);
    expect(new Set(values).size).toBe(values.length);
  });
});
