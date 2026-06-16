// アプリ内部のルート（URL）を一元管理する。
// ベタ書きを避け、パス変更をこのファイルだけで完結させるための「縫い目」。
// パラメータ付きのルートは関数で表現する（例: routes.feedback(id)）。
//
// 注意: App Router ではルートの実体はフォルダ名（app/feedbacks/[id]/page.tsx）が決める。
// このファイルが集約するのは、その URL を「参照する側」（Link / fetch / redirect）だけ。
// フォルダ自体のリネームは別途必要。
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  submit: "/submit",

  feedback: (id: string) => `/feedbacks/${id}`,
  book: (id: string) => `/books/${id}`,
  user: (id: string) => `/users/${id}`,

  auth: {
    confirm: "/auth/confirm",
    error: "/auth/error",
    verified: "/auth/verified",
  },

  admin: {
    feedbacks: "/admin/feedbacks",
    feedback: (id: string) => `/admin/feedbacks/${id}`,
    publishers: "/admin/publishers",
    publisherNew: "/admin/publishers/new",
    publisher: (id: string) => `/admin/publishers/${id}`,
    users: "/admin/users",
    user: (id: string) => `/admin/users/${id}`,
    logs: "/admin/logs",
  },

  api: {
    feedbacks: "/api/feedbacks",
    feedback: (id: string) => `/api/feedbacks/${id}`,
    booksSearch: "/api/books/search",
    adminUser: (id: string) => `/api/admin/users/${id}`,
    adminUserPublishers: (id: string) => `/api/admin/users/${id}/publishers`,
  },
} as const;
