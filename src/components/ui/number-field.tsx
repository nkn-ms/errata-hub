"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { KeyboardEvent } from "react";
import { normalizeDigits, toIntOrNull } from "@/utils/parse";
import { cn } from "@/lib/utils";

// 版・刷・ページ番号・行番号など「1以上の整数」を入れる欄。投稿フォームと管理画面で共用する。
//
// なぜ <input type="number"> を使わないか:
//   全角で「１４１」と入ると type="number" は値を不正とみなし、**JS からは input.value が空文字にしか見えない**
//   （仕様）。つまり「全角を検出して半角に直す」処理が書けない。IME の確定の仕方によって
//   半角に変換されたりされなかったりするため、実際に本番の投稿で「数字を入力してください」で
//   止まる事故が起きた（2026-07-28）。
//   type="text" にすれば生の文字列を読めるので blur で NFKC 正規化できる。
//   スマホの数字キーパッドは inputMode="numeric" が担うので失われない。
//
// 失われるネイティブの機能はこのコンポーネントで補う:
//   ▲▼ ボタン / ↑↓ キーでの増減（小さい数字の入力で実際に使われている）。
//   逆に、ホイールで値が勝手に変わる type="number" の誤操作は起きなくなる。
//
// アクセシビリティ: 入力欄自体に role="spinbutton" を与え、現在値と下限を伝える。
// ▲▼ ボタンはネイティブのスピナーに合わせてタブ移動の対象にせず（tabIndex={-1}）、
// 支援技術には隠す（キーボード操作は ↑↓ キーが担うため、二重に読み上げても操作は増えない）。
export function NumberField({
  id,
  value,
  onChange,
  min = 1,
  placeholder,
  className,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** 下限。既定は 1（版・刷・ページ・行はいずれも 1 始まり） */
  min?: number;
  placeholder?: string;
  /** 幅などの上書き（既定は w-full） */
  className?: string;
  describedBy?: string;
}) {
  const current = toIntOrNull(value);

  function step(delta: number) {
    // 未入力から ▲ を押したときは下限から始める（0 や空文字にしない）
    const next = current === null ? min : current + delta;
    onChange(String(Math.max(min, next)));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    // 既定動作（カーソルの行移動）を止めて増減に充てる＝ type="number" と同じ操作感
    e.preventDefault();
    step(e.key === "ArrowUp" ? 1 : -1);
  }

  return (
    <div className={cn("relative", className ?? "w-full")}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-valuenow={current ?? undefined}
        aria-valuemin={min}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 変換は確定後（blur）に行う。入力中に書き換えると IME の変換候補を壊す
        onBlur={() => {
          const normalized = normalizeDigits(value);
          if (normalized !== value) onChange(normalized);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md pl-3 pr-7 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="absolute inset-y-px right-px flex w-6 flex-col divide-y divide-gray-200 overflow-hidden rounded-r-md border-l border-gray-200">
        <StepButton label="1増やす" onClick={() => step(1)}>
          <ChevronUp className="h-3 w-3" />
        </StepButton>
        <StepButton label="1減らす" onClick={() => step(-1)}>
          <ChevronDown className="h-3 w-3" />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // ネイティブのスピナーと同じく、タブ移動では止まらない・読み上げには出さない
      tabIndex={-1}
      aria-hidden
      title={label}
      // 押してもフォーカスを入力欄に残す（ネイティブのスピナーと同じ。既定のままだと
      // ボタンにフォーカスが移り、続けて数字を打てなくなる）
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex flex-1 items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
    >
      {children}
    </button>
  );
}
