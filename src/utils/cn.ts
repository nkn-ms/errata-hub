import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind のクラスを結合する。ただの連結ではなく、**後から渡したクラスが同じ種類の既定を
 * 上書きする**（twMerge が `px-4` と `px-6` のような衝突を解決して後勝ちにする）。
 *
 * これが要るのは、UI 部品が className で見た目の一部を開けているため。Button は既定の `px-4` を
 * 持ちつつ、送信ボタン10箇所が `px-6` を渡して広げている。単純な連結だと両方が class 属性に残り、
 * **どちらが効くかは Tailwind が生成する CSS の並び順しだい**になる＝「呼び出し側が上書きできる」が
 * 部品の約束ではなく偶然になる。clsx だけでは足りないのはこの一点。
 *
 * ⚠️ **tailwind-merge のメジャーは Tailwind のメジャーと対で選ぶ**（v3 = Tailwind v4 用）。
 *    衝突の判定表を内部に持っているので、ずれると黙って誤った結果を返す。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
