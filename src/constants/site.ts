// サイト全体で参照する外部情報・メタ値を集約する。
// 内部ルートは routes.ts、こちらは外部 URL やサイト名など「アプリ外」を指す値。
export const site = {
  name: "Errata Hub",
  description: "技術書の正誤情報・改善提案を読者が投稿して共有する公開サイト。",
  // ⚠️ リポジトリは現在 private。public 化と同時にこのリンクが有効になる（それまで訪問者には 404）。
  repoUrl: "https://github.com/nkn-ms/errata-hub",
} as const;
