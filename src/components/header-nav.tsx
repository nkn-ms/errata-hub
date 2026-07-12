"use client";

import { useState } from "react";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { logout } from "@/app/actions/auth";

// 常時出す情報ページのナビ項目。デスクトップ列・モバイルメニューの両方で使い回す。
const NAV_LINKS = [
  { href: routes.howToUse, label: "使い方" },
  { href: routes.tech, label: "使用技術" },
] as const;

// ドロップダウン内の項目に共通の見た目（デスクトップのユーザーメニュー・モバイルメニュー共用）。
const dropdownItemClass = "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

// ログイン済みのドロップダウン項目（アカウント設定＋ログアウト）。両メニューで共用。
function AccountMenuItems({ onSelect }: { onSelect?: () => void }) {
  return (
    <>
      <Link href={routes.account} onClick={onSelect} role="menuitem" className={dropdownItemClass}>
        アカウント設定
      </Link>
      <form action={logout}>
        <button type="submit" role="menuitem" className={`w-full text-left ${dropdownItemClass}`}>
          ログアウト
        </button>
      </form>
    </>
  );
}

// デスクトップのユーザーメニュー。表示名クリックで開き、ログアウトをここに集約する
// （主 CTA「投稿する」の真横に並べないことで誤操作を防ぐ）。
function DesktopUserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="hidden sm:block relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span className="max-w-[10rem] truncate">{userName}</span>
        <ChevronDownIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          {/* 外側クリックで閉じる透明バックドロップ */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-20"
          >
            <AccountMenuItems onSelect={close} />
          </div>
        </>
      )}
    </div>
  );
}

// モバイル（sm 未満）用。ハンバーガーで全ナビ＋認証操作を1つのメニューに集約する。
function MobileMenu({ userName }: { userName: string | null }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <HamburgerIcon open={open} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              role="menuitem"
              className={dropdownItemClass}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 border-t border-gray-100" />
          {userName ? (
            <>
              <span className="block px-4 py-2 text-xs text-gray-500 truncate">{userName}</span>
              <AccountMenuItems onSelect={close} />
            </>
          ) : (
            <>
              <Link href={routes.register} onClick={close} role="menuitem" className={dropdownItemClass}>
                会員登録
              </Link>
              <Link href={routes.login} onClick={close} role="menuitem" className={dropdownItemClass}>
                ログイン
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ヘッダー右側のナビ。sm 以上はインライン、sm 未満は MobileMenu に集約。
// 主 CTA「投稿する」だけは常時表示。
export function HeaderNav({ userName }: { userName: string | null }) {
  return (
    <div className="relative flex items-center gap-3">
      {/* デスクトップの情報ページリンク（sm 以上） */}
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {link.label}
        </Link>
      ))}

      {/* デスクトップの認証状態（sm 以上） */}
      {userName ? (
        <DesktopUserMenu userName={userName} />
      ) : (
        <>
          <Link
            href={routes.register}
            className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            会員登録
          </Link>
          {/* 塗りは主 CTA「投稿する」（青）に譲り、ログインは枠線で階層を下げる */}
          <Link
            href={routes.login}
            className="hidden sm:block text-sm text-gray-700 border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            ログイン
          </Link>
        </>
      )}

      {/* 主 CTA（常時表示） */}
      <Link
        href={routes.submit}
        className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
      >
        投稿する
      </Link>

      <MobileMenu userName={userName} />
    </div>
  );
}
