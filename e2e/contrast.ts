import type { Page } from "@playwright/test";

// 表示中のページの「文字色 vs 実際に見えている地」を総当たりで測り、
// WCAG AA を割っているものだけを返すヘルパー。
//
// なぜ総当たりか: 色は globals.css のトークン1か所で決めているので、1つの値の選び直しが
// サイト全体の何十か所に効く。要素を1つずつ書くより「基準を割る文字が無い」を押さえた方が、
// 次に色を触ったときの網になる。
//
// 判定基準（出典: https://www.w3.org/TR/WCAG21/#contrast-minimum ）:
//   通常の文字 4.5:1 ／ 大きい文字（24px 以上、または 18.66px 以上の太字）3:1
//
// 計算値の色は rgb() とは限らない（Tailwind v4 の既定パレットは oklch()/lab() で返る）ので、
// canvas に 1px 描いて読み、どの記法でも sRGB に揃える（dark-mode.spec.ts と同じ手）。

export type ContrastFinding = {
  /** 対象の文字（先頭のみ） */
  text: string;
  /** どの要素か（タグ＋先頭のクラス） */
  where: string;
  ratio: number;
  required: number;
  fontSize: number;
};

export async function findLowContrastText(page: Page): Promise<ContrastFinding[]> {
  return page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const toRgba = (color: string): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const luminance = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // 背景は透明なことが多いので、不透明な祖先までさかのぼって「実際に見えている地」を採る
    const effectiveBackground = (el: Element): number[] => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const c = toRgba(getComputedStyle(node).backgroundColor);
        if (c[3] > 128) return c;
      }
      return [255, 255, 255, 255];
    };
    const describe = (el: Element) => {
      const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
    };

    const findings: ContrastFinding[] = [];

    for (const el of Array.from(document.querySelectorAll("body *"))) {
      // 直接の子テキストだけを見る（親でまとめて数えると同じ文字を何度も判定してしまう）
      const ownText = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!ownText) continue;

      // 装飾（aria-hidden）は読み上げ対象外＝情報を運んでいないので除く。
      // 無効な部品も WCAG 1.4.3 の適用外（inactive user interface components）。
      // ページ送りの行き先が無い側は <span aria-disabled> で表しているのでそれも拾う
      if (el.closest("[aria-hidden='true']")) continue;
      if (el.closest(":disabled, [aria-disabled='true']")) continue;

      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (Number(style.opacity) < 0.5) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fontSize = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      const required = isLargeText ? 3 : 4.5;

      const ratio = contrast(toRgba(style.color), effectiveBackground(el));
      if (ratio < required) {
        findings.push({
          text: ownText.slice(0, 30),
          where: describe(el),
          ratio: Math.round(ratio * 100) / 100,
          required,
          fontSize,
        });
      }
    }
    return findings;
  });
}

/**
 * 2つの要素の「実際に見えている地」同士のコントラスト比。
 *
 * 文字ではなく**面と面**を測る。面で状態を示している箇所（ナビの現在地のピル vs 帯）は、
 * 文字コントラストが足りていても面の差が小さいと「選択されている」ことが読み取れない
 * ＝実際に起きた（現在地を帯より一段明るいだけの gray-800 にしていて見分けられなかった）。
 * 見分けに要る比は 3:1（出典: https://www.w3.org/TR/WCAG21/#non-text-contrast ）。
 */
export async function backgroundContrast(
  page: Page,
  selector: string,
  againstSelector: string
): Promise<number> {
  return page.evaluate(
    ([selector, againstSelector]) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const toRgba = (color: string): number[] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const luminance = (c: number[]) => {
        const [r, g, b] = c.slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const background = (sel: string): number[] => {
        const start = document.querySelector(sel);
        if (!start) throw new Error(`要素が見つからない: ${sel}`);
        for (let node: Element | null = start; node; node = node.parentElement) {
          const c = toRgba(getComputedStyle(node).backgroundColor);
          if (c[3] > 128) return c;
        }
        return [255, 255, 255, 255];
      };
      const [hi, lo] = [luminance(background(selector)), luminance(background(againstSelector))].sort(
        (x, y) => y - x
      );
      return (hi + 0.05) / (lo + 0.05);
    },
    [selector, againstSelector]
  );
}

/** 失敗時に何をどう直すか分かるメッセージ（比率と場所の一覧） */
export function formatFindings(findings: ContrastFinding[]): string {
  return findings
    .map((f) => `  ${f.ratio}:1（要 ${f.required}:1・${f.fontSize}px）"${f.text}" ← ${f.where}`)
    .join("\n");
}
