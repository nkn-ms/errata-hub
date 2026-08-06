import { describe, it, expect } from "vitest";
import {
  AUDIT_ACTION,
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  TARGET_TYPE,
} from "@/constants/audit";

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

describe("AUDIT_ACTION", () => {
  // 既存の AuditLog 行がこの文字列を持っているので、値を変えると古い記録が絞り込みから外れる。
  // キー名と値が一致していることを固定して、うっかりの書き換えを落とす
  it("キー名と値が一致する", () => {
    for (const [key, value] of Object.entries(AUDIT_ACTION)) {
      expect(value).toBe(key);
    }
  });

  it("値に重複がない", () => {
    const values = Object.values(AUDIT_ACTION);
    expect(new Set(values).size).toBe(values.length);
  });

  // ラベルの欠けは Record<AuditAction, string> により tsc が落とすので、ここでは中身の質を見る
  it("ラベルが全操作にあり、重複しない", () => {
    const labels = Object.values(AUDIT_ACTION_LABELS);
    expect(labels).toHaveLength(Object.keys(AUDIT_ACTION).length);
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("退会系3件が隣り合う（探しているときに目に入るのが記録の目的）", () => {
    const keys = Object.keys(AUDIT_ACTION_LABELS);
    const withdrawal = [
      AUDIT_ACTION.WITHDRAW_USER,
      AUDIT_ACTION.ADMIN_WITHDRAW_USER,
      AUDIT_ACTION.WITHDRAWAL_INCOMPLETE,
    ].map((action) => keys.indexOf(action));
    expect(withdrawal).toEqual([keys.length - 3, keys.length - 2, keys.length - 1]);
  });
});

describe("auditActionLabel", () => {
  it("定義済みの操作は日本語ラベルにする", () => {
    expect(auditActionLabel(AUDIT_ACTION.CREATE_PUBLISHER)).toBe("出版社作成");
    expect(auditActionLabel(AUDIT_ACTION.WITHDRAWAL_INCOMPLETE)).toBe("退会（未完了）");
  });

  // 廃止した操作の行が DB に残っていても落ちない。読めない方がまだ正確なのでそのまま出す
  it("定義に無い文字列はそのまま返す", () => {
    expect(auditActionLabel("RETIRED_ACTION")).toBe("RETIRED_ACTION");
  });
});
