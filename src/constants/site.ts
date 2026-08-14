// サイト全体で参照する外部情報・メタ値を集約する。
// 内部ルートは routes.ts、こちらは外部 URL やサイト名など「アプリ外」を指す値。
export const site = {
  name: "Errata Hub",
  description: "技術書の正誤情報・改善提案を読者が投稿して共有する公開サイト。",
  // 正規の公開 URL。sitemap.xml は絶対 URL を要求するため必要。
  // env にせず定数なのは「検索エンジンに伝える正規の住所」が環境で変わってはいけないため
  // （Preview のビルドでもここを出す。本番ドメインを取得したらこの1行を差し替える）。
  url: "https://errata-hub.vercel.app",
  // 問い合わせ・開示等請求の窓口（利用規約・プライバシーポリシーで参照）。
  contactEmail: "nkn-ms+errata-hub@hotmail.co.jp",
  // 著作権表示の開始年（固定）。現在年と異なれば「開始年–現在年」の範囲表記になる。
  // ⚠️ 正式な「公開開始年」は public ローンチ時に確定。それまで 2026 を仮置き。
  foundedYear: 2026,
  repoUrl: "https://github.com/nkn-ms/errata-hub",
} as const;
