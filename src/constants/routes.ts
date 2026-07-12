// アプリ内部のルート（URL）を一元管理する。
// ベタ書きを避け、パス変更をこのファイルだけで完結させるための「縫い目」。
// パラメータ付きのルートは関数で表現する（例: routes.report(id)）。
//
// 注意: App Router ではルートの実体はフォルダ名（app/reports/[id]/page.tsx）が決める。
// このファイルが集約するのは、その URL を「参照する側」（Link / fetch / redirect）だけ。
// フォルダ自体のリネームは別途必要。
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  submit: "/submit",
  howToUse: "/how-to-use",
  tech: "/tech",
  terms: "/terms",
  privacy: "/privacy",
  account: "/account",
  accountWithdraw: "/account/withdraw",
  accountWithdrawn: "/account/withdrawn",

  report: (id: string) => `/reports/${id}`,
  book: (id: string) => `/books/${id}`,
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
    reportImages: (id: string) => `/api/reports/${id}/images`,
    booksSearch: "/api/books/search",
    booksOpenbd: "/api/books/openbd",
  },
} as const;
