import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * 見た目を揃えた選択欄。
 *
 * ⚠️ 素の `<select>` を使わない理由: ブラウザ既定の矢印は**枠の右端に貼り付き、文字との間が空く**
 * （幅は最も長い選択肢で決まるため、短い選択肢を選んでいるときほど間延びする）。
 * 位置も形も CSS から動かせないので、`appearance-none` にして自前の矢印を重ねる。
 *
 * ⚠️ 矢印には `pointer-events-none` が要る。付けないと矢印の上でクリックしても
 * ドロップダウンが開かない（クリックが select に届かない）。
 */
export function SelectField({
  className,
  wrapperClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * 外側（矢印を重ねるための包み）のクラス。
   * ⚠️ 包みが1枚挟まるので、親が flex のときの `flex-1` などは**こちらに渡す**
   *    （select 側に付けても包みが伸びないため効かない）。
   */
  wrapperClassName?: string;
}) {
  return (
    <span className={cn("relative inline-flex", wrapperClassName)}>
      <select
        {...props}
        className={cn(
          "appearance-none border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
      />
    </span>
  );
}
