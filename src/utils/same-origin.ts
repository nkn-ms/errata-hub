/**
 * Route Handler 用の同一オリジン検査（CSRF 対策）。
 *
 * なぜ要るか: Server Actions には Next.js が自動で CSRF 対策を入れている
 * （POST 限定 ＋ Origin と Host（または X-Forwarded-Host）の一致検査。
 *  出典: node_modules/next/dist/docs/01-app/02-guides/data-security.md L548-550）。
 * ところが Route Handler はこの保護の外にあり、画像アップロードだけは
 * ボディ上限の都合で Route Handler になっている（= api/reports/[id]/images）。
 * 守りが SameSite=Lax と認証だけになるので、同じ検査を自前で足す。
 *
 * ⚠️ Origin が無いリクエストは拒否する。ブラウザは POST に必ず Origin を付けるので、
 * 欠けているのはブラウザ以外からの呼び出しを意味する。このエンドポイントは
 * 自分のフォームからしか使わないため、通す理由がない。
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    // Origin は "https://example.com"（パス無し）。ポートまで含めて比べるため host どうしを比較する
    return new URL(origin).host === host;
  } catch {
    // Origin が URL として壊れている（"null" 等）
    return false;
  }
}

/**
 * リクエストヘッダから同一オリジンかを判定する。
 * Host より X-Forwarded-Host を優先するのは、Vercel のようにリバースプロキシの背後で動く場合、
 * ブラウザが見ている（＝Origin と一致する）ホスト名がこちらに入るため。Next.js 本体と同じ順序。
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  return isSameOrigin(headers.get("origin"), host);
}
