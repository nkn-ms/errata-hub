import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/constants/rate-limits";
import { checkRateLimit, rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";

// OpenBD 書誌照会をサーバー経由にする。
// ブラウザから直接 api.openbd.jp を叩くとユーザーの IP アドレス等が OpenBD 側に渡るため、
// サーバーが代理で取得して中継する（プライバシーポリシー第4条の「ISBN のみ送信」を実装上も担保）。
// ISBN のカンマ区切りを受け取り、OpenBD のレスポンス（summary を含む配列）をそのまま返す。
const MAX_ISBNS = 20;

export async function GET(request: NextRequest) {
  // 認証必須: 書籍検索フローはログイン必須の /submit からのみ使う。未ログインの代理アクセスを防ぐ。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limit = await checkRateLimit(
    rateLimitKey("booksOpenbd", user.id),
    RATE_LIMITS.booksOpenbd
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterSec) },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const raw = request.nextUrl.searchParams.get("isbn")?.trim();
  if (!raw) {
    return NextResponse.json([]);
  }

  // ISBN-10（末尾チェックディジットは X 可）/ ISBN-13 の形式のみ許可。
  // 余計な文字列を OpenBD に転送しない（バリデーション＋件数上限）。
  const isbns = raw
    .split(",")
    .map((s) => s.replace(/-/g, "").trim())
    .filter((s) => /^(?:\d{9}[\dX]|\d{13})$/.test(s))
    .slice(0, MAX_ISBNS);
  if (isbns.length === 0) {
    return NextResponse.json([]);
  }

  // ⚠️ 空配列は「その ISBN に該当が無い」の意味だけに使い、**上流の失敗には使わない**。
  //    ISBN 検索では返り値がそのまま答えなので、失敗を空配列にすると画面が
  //    「該当する書籍が見つかりませんでした。ISBNをご確認ください。」＝利用者の入力が
  //    悪いことにしてしまう（実際は OpenBD が落ちている）。
  //    タイトル検索の書誌補正（book-search.tsx の enrichWithOpenBD）は !res.ok を
  //    「Google の値をそのまま使う」で扱うので、502 にしても壊れず degrade する。
  try {
    const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbns.join(",")}`);
    if (!res.ok) {
      console.error("OpenBD API error:", res.status);
      return NextResponse.json({ error: "書籍情報の取得に失敗しました。しばらくしてからお試しください。" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("OpenBD API error:", error);
    return NextResponse.json({ error: "書籍情報の取得に失敗しました。しばらくしてからお試しください。" }, { status: 502 });
  }
}
