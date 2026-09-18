/**
 * 追記・回答の id を管理者に見せる。⭐ **公開ページには出さない**（読者には意味が無く、
 * 出すと「この id を引用して問い合わせる」導線を作ったことになる）。
 *
 * 全文を出すのは、**表示している値がそのまま DB を引ける値であるため**。先頭数文字に縮めると
 * 短い側は同定に使えない（衝突しうる）ので、短縮するなら別途コピーの手段が要る。
 * `select-all` は1クリックで全文を選べるようにするためのもの。
 */
export function RecordId({ value }: { value: string }) {
  return (
    <span className="text-xs text-gray-500">
      ID <code className="font-mono select-all break-all">{value}</code>
    </span>
  );
}
