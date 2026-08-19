// アプリ内部のルート（URL）を一元管理する。
// ベタ書きを避け、パス変更をこのファイルだけで完結させるための「縫い目」。
// パラメータ付きのルートは関数で表現する（例: routes.report(id)）。
//
// 注意: App Router ではルートの実体はフォルダ名（app/(site)/reports/[id]/page.tsx）が決める。
// 括弧付きの (site) はルートグループで URL には出ない（= app/(site)/layout.tsx のコメント）。
// このファイルが集約するのは、その URL を「参照する側」（Link / fetch / redirect）だけ。
// フォルダ自体のリネームは別途必要。
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  submit: "/submit",
  // 書籍ページの「この本に投稿する」用。対象の本を確定した状態で投稿フォームを開く
  // （素の /submit と同じページで、書籍検索の代わりに確定表示を出す）。
  submitForBook: (isbn: string) => `/submit?isbn=${isbn}`,
  howToUse: "/how-to-use",
  tech: "/tech",
  design: "/design",
  terms: "/terms",
  privacy: "/privacy",
  account: "/account",
  accountWithdraw: "/account/withdraw",
  accountWithdrawn: "/account/withdrawn",

  // 投稿の検索・一覧ページ（種別/ステータス絞り込み付きテーブル）。トップの検索ボックスの遷移先。
  reports: "/reports",
  report: (id: string) => `/reports/${id}`,
  // 投稿者が自分の投稿を直す画面（他人が開くと投稿の詳細へ戻される）
  reportEdit: (id: string) => `/reports/${id}/edit`,
  // 書籍だけ UUID でなく ISBN を URL に使う。ISBN は「本の同一性の基準」（Book.isbn は @unique）で
  // 外部から参照・共有される値なので、公開後に変えられない URL は自然キー側に寄せる。
  book: (isbn: string) => `/books/${isbn}`,
  user: (id: string) => `/users/${id}`,

  auth: {
    callback: "/auth/callback",
    confirm: "/auth/confirm",
    error: "/auth/error",
    verified: "/auth/verified",
    resetPassword: "/auth/reset-password",
    resetPasswordSent: "/auth/reset-password/sent",
    updatePassword: "/auth/update-password",
  },

  admin: {
    reports: "/admin/reports",
    report: (id: string) => `/admin/reports/${id}`,
    publishers: "/admin/publishers",
    publisherNew: "/admin/publishers/new",
    publisher: (id: string) => `/admin/publishers/${id}`,
    users: "/admin/users",
    user: (id: string) => `/admin/users/${id}`,
    books: "/admin/books",
    book: (id: string) => `/admin/books/${id}`,
    logs: "/admin/logs",
  },

  // 内部 UI からの更新は Server Actions（src/app/actions/）へ移行済み。
  // ここに残る API Route は「HTTP 境界が本当に必要なもの」だけ:
  //   - 画像アップロード（Server Actions のボディ上限 1MB を超えるバイナリの受口）
  //   - 外部書誌 API（OpenBD / Google Books）のプロキシ（読み取り）
  api: {
    // addendumId を渡すとその追記に紐づく画像として保存する（省略＝投稿本体の画像）。
    // ボディではなくクエリで受けるのは、枚数の上限判定を**本文を読む前**に行うため
    // （どちらの枠で数えるかが addendumId で決まる = api/reports/[id]/images）
    reportImages: (id: string, addendumId?: string) =>
      addendumId === undefined
        ? `/api/reports/${id}/images`
        : `/api/reports/${id}/images?addendumId=${encodeURIComponent(addendumId)}`,
    booksSearch: "/api/books/search",
    booksOpenbd: "/api/books/openbd",
  },
} as const;
