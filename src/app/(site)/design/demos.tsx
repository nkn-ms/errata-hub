"use client";

import { useState } from "react";
import { NumberField } from "@/components/ui/number-field";
import { SelectField } from "@/components/ui/select-field";
import { CharCounter, ErrorPanel } from "@/features/report/components/report-fields";
import { Button } from "@/components/ui/button";

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

export function SelectFieldDemo() {
  const [value, setValue] = useState("all");
  return (
    <div className="space-y-2">
      <SelectField
        aria-label="見本の絞り込み"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="all">種別：すべて</option>
        <option value="errata">正誤情報</option>
        <option value="suggestion">改善提案</option>
      </SelectField>
      <p className="text-xs text-gray-500">選んでいる値: {value}</p>
    </div>
  );
}

export function CharCounterDemo() {
  const [value, setValue] = useState("");
  const max = 40;
  return (
    <div className="max-w-xs">
      <label htmlFor="demo-counter" className="block text-sm font-medium text-gray-700 mb-1">
        概要
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
      <Button
        type="button"
        onClick={() => setShown((prev) => !prev)}
        variant="secondary"
        className="px-3 py-1.5"
      >
        {shown ? "閉じる" : "検証に失敗したときの表示を見る"}
      </Button>
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
