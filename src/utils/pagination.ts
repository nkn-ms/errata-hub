/**
 * `?page=N` の一覧で毎回する計算（全部で何ページか・範囲外か・今は何件目から何件目か）。
 *
 * 呼び出し側は「1ページ分を取る」クエリ（skip/take）と「全件数」を数えるクエリを並列で投げるので、
 * skip/take はここでは作らない（total が分かる前に決まる値なので、ここに置くと順番が逆になる）。
 *
 * ⚠️ skip/take のページングは**並び順が同値の行を区別できない**。`createdAt` が同一の行が
 * ページの境目にまたがると、同じ行が2ページに出たり、どのページにも出なかったりする
 * （Postgres は ORDER BY で決着が付かない行の順序を保証しない）。
 * このため呼び出し側の orderBy には必ず一意な列（id）を最後に足して決着させる。
 */
export function paginate(page: number, total: number, pageSize: number) {
  // 0件でも「1 / 1 ページ」と言えるように下限を1にする（0ページ目は存在しない）
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    totalPages,
    // 範囲外の ?page=N（古いリンク・打ち間違い）は最後の有効ページへ寄せたい。
    // 件数はあるのに空スライスを引いて「まだありません」を誤表示するのを防ぐのが目的なので、
    // 0件のときは寄せる先が無く対象外（そのとき出したいのは本当に「ありません」）。
    isOutOfRange: total > 0 && page > totalPages,
    // 「51〜100 件目 / 全 240 件」の 51 と 100。最終ページは端数で切り上がるので to は total で止める
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
  };
}
