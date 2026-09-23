import "server-only";
import { parseOpenBdBooks, type UpstreamBook } from "@/lib/book-upstream";

// 応答が返らない相手を待ち続けない（理由は api/books/search/route.ts の UPSTREAM_TIMEOUT_MS）
const OPENBD_TIMEOUT_MS = 5_000;

/**
 * OpenBD に ISBN（複数可）で書誌を問い合わせる。
 *
 * **上流の失敗は例外で返す。** 見つからなかったときの空配列と区別するため
 * （区別しないと、画面が「ISBN をご確認ください」＝利用者の入力ミスとして表示してしまう
 * = api/books/openbd/route.ts）。倒し方は呼び出し側が決める。
 */
export async function fetchOpenBdBooks(isbns: string[]): Promise<UpstreamBook[]> {
  const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbns.join(",")}`, {
    signal: AbortSignal.timeout(OPENBD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`OpenBD API error: ${res.status}`);
  }
  // 上流の形が変わっていたら例外（lib/book-upstream.ts）
  return parseOpenBdBooks(await res.json());
}
