import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimits, rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";

const MAX_QUERY_LENGTH = 100;

// Google Books は散発的に 503 "Service temporarily unavailable." を返す
// （2026-08-17 に本番で 30分に4件。同じ時間帯の別のクエリは 200 なので入力には依存しない）。
// もう一度投げれば通る種類なので、ここで1回だけやり直して利用者に見せない。
const UPSTREAM_RETRY_DELAY_MS = 300;

/**
 * Google Books を叩く。**5xx と通信エラーのときだけ1回やり直す。**
 *
 * ⚠️ 429（バースト制限）と 4xx は再試行しない: 前者は待たないと意味がなく、
 *    後者（403 の枠切れ・400 の不正なクエリ）は何度投げても同じ結果になる。
 *
 * ⚠️ やり直しはこの層でしかできない。呼び出し元は上流の失敗を**すべて 502 に潰して**返すので
 *    （503 を透過すると「このサービスが落ちている」の意味になってしまうため）、
 *    クライアントからは「再試行すれば通るのか」を区別できない。
 */
async function fetchGoogleBooks(url: string): Promise<Response> {
  try {
    const res = await fetch(url);
    if (res.status < 500) return res;
    console.warn("Google Books API retrying after", res.status);
  } catch (error) {
    console.warn("Google Books API retrying after network error:", error);
  }
  await new Promise((resolve) => setTimeout(resolve, UPSTREAM_RETRY_DELAY_MS));
  return fetch(url);
}

export async function GET(request: NextRequest) {
  // 認証必須: 未ログインでも叩けると Google Books API キーの quota を悪用される。
  // 書籍検索を使う /submit はログイン必須なので正規フローには影響しない。
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // ウィンドウを2つ見る: 分のウィンドウはタイプアヘッド（400ms デバウンス）を通す幅、
  // 日のウィンドウは Google Books の無料枠を1人に使い切らせないための壁（枠はプロジェクト全体で共有）
  const limit = await checkRateLimits([
    { key: rateLimitKey("booksSearch:min", user.id), rule: RATE_LIMITS.booksSearchPerMinute },
    { key: rateLimitKey("booksSearch:day", user.id), rule: RATE_LIMITS.booksSearchPerDay },
  ]);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterSec) },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ items: [] });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "検索語が長すぎます" }, { status: 400 });
  }

  // type=isbn で ISBN 完全一致検索。OpenBD に書影が無いときの書影補完に使う。
  const searchType = request.nextUrl.searchParams.get("type");
  const isIsbnSearch = searchType === "isbn";

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const q = isIsbnSearch
    ? `isbn:${encodeURIComponent(query.replace(/-/g, ""))}`
    : `intitle:${encodeURIComponent(query)}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20&printType=books&country=JP&key=${apiKey}`;

  try {
    const res = await fetchGoogleBooks(url);
    if (!res.ok) {
      // Google 側のエラーJSON（キー情報を含み得る）はそのまま返さない。
      console.error("Google Books API error:", res.status, await res.text());
      // ⚠️ 502（Bad Gateway＝上流から無効な応答を受けた）に**意図的に置き換えている**。
      //    Google の 503 をそのまま返すと「Errata Hub 自身が使えない」の意味になってしまう。
      return NextResponse.json({ error: "書籍検索に失敗しました。しばらくしてからお試しください。" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "書籍検索に失敗しました。しばらくしてからお試しください。" }, { status: 502 });
  }
}
