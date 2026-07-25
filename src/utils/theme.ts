// 表示テーマ（ライト／ダーク）の選択肢と、それを実際の見た目へ解決するロジック。
//
// 配色そのものは globals.css の `:root[data-theme="dark"]` 1か所だけに書く（トークン反転方式）。
// 「OS の設定に合わせる」は CSS の `@media (prefers-color-scheme: dark)` ではなく、
// **初期化スクリプトが matchMedia を読んで data-theme を書く**ことで実現している。
// こうしないと「OS 追従用の @media」と「明示指定用の [data-theme]」に同じ 90 行の配色を
// 二重管理することになり、片方だけ直す事故が必ず起きる。
// トレードオフ: JS を切ったブラウザではライト固定になる（配色以外の表示・遷移は動く）。

export const THEME_STORAGE_KEY = "theme";

/** ボタンで選べる値。保存するのはこの3値（"system" は保存せず削除する） */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** 実際に適用される見た目 ＝ <html data-theme> に入る値 */
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICE_LABELS: Record<ThemeChoice, string> = {
  system: "OS の設定に合わせる",
  light: "ライト",
  dark: "ダーク",
};

export const OS_DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/** ボタン1つで回すための順送り（OS の設定 → ライト → ダーク → OS の設定…） */
export function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  const nextIndex = (THEME_CHOICES.indexOf(current) + 1) % THEME_CHOICES.length;
  return THEME_CHOICES[nextIndex];
}

export function resolveTheme(choice: ThemeChoice, osPrefersDark: boolean): ResolvedTheme {
  if (choice === "system") return osPrefersDark ? "dark" : "light";
  return choice;
}

// <head> で同期実行する初期化スクリプト。最初の描画より前に data-theme を確定させて
// テーマのちらつき（ライトで一瞬描かれてから暗くなる）を防ぐ。
// 出典: Next.js「How to prevent flash before hydration」§Themes
//   node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
//
// ⚠️ ここは resolveTheme と同じ判定を素の JS で書き写している（バンドル前に走るので import できない）。
//    両者が本当に一致することは utils/theme.test.ts でこの文字列を実行して確かめている。
//    保存値が壊れていても（"system" や想定外の文字列でも）OS 追従に落ちるようにしてある。
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var d=c==="dark"||(c!=="light"&&window.matchMedia(${JSON.stringify(
  OS_DARK_QUERY
)}).matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
