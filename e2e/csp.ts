import type { Page } from "@playwright/test";

// CSP 違反の収集。ヘッダの有無だけを見ても「厳しすぎて自分の画面を壊した」は検出できないので、
// 実ブラウザで securitypolicyviolation イベントを拾い、0件であることを検査する。
//
// コンソール出力の文言で判定しないのは、Chromium の文言変更で検査が空振りになるのを避けるため。
// addInitScript は CDP 経由でページのスクリプトより前に実行され、CSP の対象外なので
// 「検査用のスクリプト自身がブロックされる」ことは起きない。

export type CspViolation = {
  directive: string;
  blockedUri: string;
  /** ブロックされたコード・スタイルの冒頭（原因の特定用。ブラウザが出す範囲だけ） */
  sample: string;
};

const GLOBAL_KEY = "__cspViolations";

/**
 * ページに違反の収集を仕込む。**goto より前に一度**呼ぶ（以降の全遷移に効く）。
 * 戻り値を呼ぶと「今開いているドキュメント」で起きた違反を返す（遷移するとリセットされる）。
 */
export async function watchCspViolations(page: Page): Promise<() => Promise<CspViolation[]>> {
  await page.addInitScript((key) => {
    const violations: CspViolation[] = [];
    (window as unknown as Record<string, CspViolation[]>)[key] = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push({
        directive: event.effectiveDirective || event.violatedDirective,
        blockedUri: event.blockedURI,
        sample: event.sample ?? "",
      });
    });
  }, GLOBAL_KEY);

  return () =>
    page.evaluate(
      (key) => (window as unknown as Record<string, CspViolation[]>)[key] ?? [],
      GLOBAL_KEY
    );
}

/** 失敗メッセージ用の整形 */
export function formatViolations(violations: CspViolation[]): string {
  return violations
    .map((v) => `  ${v.directive} がブロック: ${v.blockedUri || "(inline)"} ${v.sample}`.trimEnd())
    .join("\n");
}
