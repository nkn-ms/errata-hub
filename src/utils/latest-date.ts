/**
 * 渡した時刻のうち一番新しいもの。`undefined` は飛ばす
 * （関連の行が無いとき＝追記がまだ無い等の穴埋めを、呼び出し側に書かせないため）。
 */
export function latestDate(first: Date, ...rest: (Date | undefined)[]): Date {
  return rest.reduce<Date>(
    (latest, candidate) => (candidate !== undefined && candidate > latest ? candidate : latest),
    first
  );
}
