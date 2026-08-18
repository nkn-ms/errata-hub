"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NumberField } from "@/components/ui/number-field";
import { CharCounter, ErrorPanel } from "@/features/report/components/report-fields";

// 動かして確かめる見本だけをここに集める。ページ本体（page.tsx）はサーバーのまま保つ。

export function NumberFieldDemo() {
  const [value, setValue] = useState("");
  return (
    <div className="max-w-xs">
      <label htmlFor="demo-number" className="block text-sm font-medium text-gray-700 mb-1">
        ページ番号
      </label>
      <NumberField id="demo-number" value={value} onChange={setValue} placeholder="例: 58" />
      <p className="mt-2 text-xs text-gray-500">
        全角で「５８」と打っても半角になります。文字を混ぜても値は消えません。
      </p>
    </div>
  );
}

export function CharCounterDemo() {
  const [value, setValue] = useState("");
  const max = 40;
  return (
    <div className="max-w-xs">
      <label htmlFor="demo-counter" className="block text-sm font-medium text-gray-700 mb-1">
        タイトル
      </label>
      <input
        id="demo-counter"
        value={value}
        maxLength={max}
        onChange={(e) => setValue(e.target.value)}
        placeholder="32文字まで打つと数字が出ます"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <CharCounter id="demo-counter-count" value={value} max={max} />
    </div>
  );
}

export function ErrorPanelDemo() {
  const [shown, setShown] = useState(false);
  return (
    <div className="max-w-xl space-y-3">
      <button
        type="button"
        onClick={() => setShown((prev) => !prev)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        {shown ? "閉じる" : "検証に失敗したときの表示を見る"}
      </button>
      {shown && (
        <ErrorPanel
          errors={[
            { message: "書籍を選択してください" },
            { message: "版を入力してください" },
            { message: "ページ番号は半角数字（1以上の整数）で入力してください" },
            { message: "誤（該当箇所）を入力してください" },
          ]}
        />
      )}
    </div>
  );
}

// ⚠️ ハンバーガーの実物はこのページに置けない。切り替えが hidden sm:block / sm:hidden で、
//    Tailwind のブレークポイントは**ビューポート幅**を見るため、幅を狭めた箱に入れても
//    PC で開いている限りデスクトップ版のまま描画される。
//    そこでボタンだけ同じ見た目で作り、開いた中身は静的な複製を並べる。
export function MenuPanelDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-xs">
      <div className="relative rounded-lg border border-gray-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="メニュー（見本）"
          className="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        {open && (
          <ul className="mt-2 rounded-md border border-gray-200 bg-white py-1 text-sm shadow-sm">
            {["ホーム", "使い方", "投稿する"].map((label) => (
              <li key={label} className="px-4 py-2 text-gray-700">
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        開いた中身は複製です。実物はスマホ幅でヘッダーの右端に出ます。
      </p>
    </div>
  );
}
