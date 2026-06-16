import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_QUERY_LENGTH = 100;

export async function GET(request: NextRequest) {
  // 認証必須: 未ログインでも叩けると Google Books API キーの quota を悪用される。
  // 書籍検索を使う /submit はログイン必須なので正規フローには影響しない。
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
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
    const res = await fetch(url);
    if (!res.ok) {
      // Google 側のエラーJSON（キー情報を含み得る）はそのまま返さない。
      console.error("Google Books API error:", res.status, await res.text());
      return NextResponse.json({ error: "書籍検索に失敗しました" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "書籍検索に失敗しました" }, { status: 502 });
  }
}
