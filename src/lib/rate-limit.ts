import { prisma } from "@/lib/prisma";

/** 窓の中で何回まで許すか。しきい値の実値は src/constants/rate-limits.ts */
export type RateLimitRule = {
  limit: number;
  /** 窓の長さ（秒） */
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** 拒否したとき、窓が切り替わるまでの秒数（Retry-After ヘッダ・文言に使う）。許可時は 0 */
  retryAfterSec: number;
};

/**
 * 固定窓（fixed window）の開始時刻。現在時刻を窓幅で切り捨てるので、
 * 同じ窓に入るリクエストは全て同じ行（key, windowStart）に集まる。
 *
 * 固定窓の既知の弱点として窓の境目でバーストを許す（窓の終わり際に limit 回＋
 * 次の窓の頭に limit 回＝短時間に 2×limit 回）。ここでの目的は外部コストの青天井を防ぐことで、
 * 瞬間的な流量の平滑化ではないため、実装の単純さ（1クエリ・1行）を優先して許容している。
 */
export function windowStartFor(now: Date, windowSec: number): Date {
  const windowMs = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** 窓が切り替わるまでの残り秒数。0 を返すと即再試行になってしまうので最低 1 秒にする */
function retryAfterFor(now: Date, windowStart: Date, windowSec: number): number {
  const resetAtMs = windowStart.getTime() + windowSec * 1000;
  return Math.max(1, Math.ceil((resetAtMs - now.getTime()) / 1000));
}

/** カウンタのキー。動作ごとに独立して数えるため動作名を前置する */
export function rateLimitKey(action: string, subject: string): string {
  return `${action}:${subject}`;
}

/**
 * 1回ぶん消費して、上限内かどうかを返す。
 *
 * 「行が無ければ1で作る・あれば+1する・結果を返す」を1文の INSERT … ON CONFLICT で行う。
 * 読んでから書く2段構えにすると同時アクセスで数え落とすが、この形なら Postgres 側で
 * 直列化されるので落ちない（行ロックは競合したリクエストの間だけ）。
 *
 * 拒否したリクエストも加算する（＝叩き続けると count は上限を超えて伸びる）。
 * これは「窓の中で受け付けた回数」ではなく「窓の中で叩かれた回数」を数える設計で、
 * 上限に達した後に叩き続けても窓が延長されないという意味では利用者に不利にならない。
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(now, rule.windowSec);

  let count: number;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"
    `;
    count = rows[0]?.count ?? 0;
  } catch (error) {
    // 数えられなかったときは通す（fail open）。
    // レート制限は本来の機能ではなく保険なので、これが落ちたことで投稿や検索まで
    // 巻き添えで止める方が損失が大きい。そもそも DB が死んでいれば投稿処理自体が成立しない。
    console.error("rate limit check failed:", error);
    return { allowed: true, retryAfterSec: 0 };
  }

  if (count <= rule.limit) {
    return { allowed: true, retryAfterSec: 0 };
  }
  return { allowed: false, retryAfterSec: retryAfterFor(now, windowStart, rule.windowSec) };
}

/**
 * 複数の窓を同時に見る（例: 書籍検索の「1分30回」かつ「1日300回」）。
 * どれか1つでも超えていたら拒否し、Retry-After は最も長いものを返す。
 *
 * ⚠️ 短絡評価はしない: 全ての窓を必ず消費する。片方で拒否されたときに
 * もう片方を数えないと、拒否され続けている間に長い窓のカウントが進まなくなる。
 */
export async function checkRateLimits(
  keys: { key: string; rule: RateLimitRule }[],
  now: Date = new Date()
): Promise<RateLimitResult> {
  const results = await Promise.all(
    keys.map(({ key, rule }) => checkRateLimit(key, rule, now))
  );
  const denied = results.filter((r) => !r.allowed);
  if (denied.length === 0) {
    return { allowed: true, retryAfterSec: 0 };
  }
  return {
    allowed: false,
    retryAfterSec: Math.max(...denied.map((r) => r.retryAfterSec)),
  };
}

/** 「しばらく待ってから」を人間向けの単位に直す（秒だけだと 86400 のような読めない数字になる） */
export function formatRetryAfter(retryAfterSec: number): string {
  if (retryAfterSec < 60) return `${retryAfterSec}秒`;
  if (retryAfterSec < 60 * 60) return `${Math.ceil(retryAfterSec / 60)}分`;
  return `${Math.ceil(retryAfterSec / 3600)}時間`;
}

/** 拒否時にユーザーへ返す文言（Server Action 用。Route Handler は 429 + Retry-After も付ける） */
export function rateLimitMessage(retryAfterSec: number): string {
  return `操作が多すぎます。${formatRetryAfter(retryAfterSec)}ほど待ってからお試しください。`;
}
