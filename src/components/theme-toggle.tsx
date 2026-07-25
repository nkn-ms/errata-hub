"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OS_DARK_QUERY,
  THEME_CHOICE_LABELS,
  THEME_STORAGE_KEY,
  isThemeChoice,
  nextThemeChoice,
  resolveTheme,
  type ThemeChoice,
} from "@/utils/theme";

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

// 同じタブ内で保存値が変わったことを知らせる自前イベント。
// 標準の "storage" イベントは**他のタブ**にしか飛ばないため、これが無いと自分のクリックで再描画されない。
const THEME_CHANGE_EVENT = "errata-hub:theme-change";

// 保存値（localStorage）を React から読むための購読口。状態の正は localStorage 側に置き、
// useState で持ち直さない（＝2か所に真実があってずれる状態を作らない）。
function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    // プライベートモード等で localStorage が使えない環境。切り替えは効かないが描画は止めない
    return "system";
  }
}

// サーバーは保存値を読めないので必ず "system"。ハイドレーション時は React がこちらを使うため、
// サーバー出力と最初のクライアント描画は必ず一致する（保存済みの人はアイコンだけ直後に切り替わる）。
const getServerChoice = (): ThemeChoice => "system";

// 表示テーマの切り替えボタン（OS の設定 → ライト → ダーク の順送り）。
//
// リロード時のちらつき防止は layout.tsx の初期化スクリプトが担う（描画前に data-theme を確定）。
// このボタンの役割は「押されたら保存値を書き替え、その場で data-theme を塗り替える」ことだけ。
//
// className は**配色だけ**を差し替えるための口。既定は公開側ヘッダー（明るい面）の色で、
// 管理画面の帯は light/dark どちらでも暗い面なので、そちらでは呼び出し側が上書きする
// （twMerge が同じ種類のクラスを後勝ちで潰すので、既定と喧嘩しない）。
export function ThemeToggle({ className }: { className?: string } = {}) {
  const choice = useSyncExternalStore(subscribe, getStoredChoice, getServerChoice);

  useEffect(() => {
    const osDarkQuery = window.matchMedia(OS_DARK_QUERY);
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(choice, osDarkQuery.matches);
    };
    apply();

    // 「OS の設定に合わせる」ときだけ、開いたまま OS 側が切り替わったのに追従する
    if (choice !== "system") return;
    osDarkQuery.addEventListener("change", apply);
    return () => osDarkQuery.removeEventListener("change", apply);
  }, [choice]);

  const handleClick = () => {
    const next = nextThemeChoice(choice);
    try {
      // "system" は「保存しない」で表す（保存値なし＝OS 追従が初期化スクリプトの既定）
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 保存できない環境ではこのタブ限りの切り替えになる
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const Icon = ICONS[choice];
  const label = `表示テーマ: ${THEME_CHOICE_LABELS[choice]}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      // 現在の状態（どのテーマか）と操作（押すと切り替わる）の両方を読み上げに載せる。
      // 押すたびにラベルが変わるので、スクリーンリーダーでも結果が分かる
      aria-label={`${label}（切り替える）`}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors",
        className
      )}
    >
      <Icon className="w-5 h-5" aria-hidden />
    </button>
  );
}
