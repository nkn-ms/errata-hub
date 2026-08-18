"use client";

import { useState } from "react";
import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { routes } from "@/constants/routes";
import { logout } from "@/app/actions/auth";

// 常時出すナビ項目。デスクトップ列・モバイルメニューの両方で使い回す。
//
// 「ホーム」はロゴ（ヘッダー左端）と行き先が同じ。重複させているのは移動距離のためで、
// 右側で操作している間に画面の反対側までポインタを運ばせない。
//
// ⚠️ NavLink の現在地判定は前方一致だが、href="/" では `pathname.startsWith("//")` が
//    常に false になるため、実質「トップページに居るときだけ」点く（全ページで点きはしない）。
const NAV_LINKS = [
  { href: routes.home, label: "ホーム" },
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

// ログイン済みのドロップダウン項目（管理画面＋アカウント設定＋ログアウト）。両メニューで共用。
//
// 管理画面リンクは ADMIN のときだけ出す。これは認可ではなく表示の話で、
// /admin の砦は proxy.ts と admin/layout.tsx の requireAdminPage（services/auth.ts）が担う。
// 一般ユーザーに出しても入れはしないが、押せないリンクはノイズなので隠す。
function AccountMenuItems({ isAdmin, onSelect }: { isAdmin: boolean; onSelect?: () => void }) {
  return (
    <>
      {isAdmin && (
        <>
          <Link
            href={routes.admin.reports}
            onClick={onSelect}
            role="menuitem"
            className={dropdownItemClass}
          >
            管理画面
          </Link>
          <div className="my-1 border-t border-gray-100" />
        </>
      )}
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
function DesktopUserMenu({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="hidden sm:block relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 whitespace-nowrap text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
            <AccountMenuItems isAdmin={isAdmin} onSelect={close} />
          </div>
        </>
      )}
    </div>
  );
}

// モバイル（sm 未満）用。ハンバーガーで全ナビ＋認証操作を1つのメニューに集約する。
function MobileMenu({ userName, isAdmin }: { userName: string | null; isAdmin: boolean }) {
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
            <NavLink
              key={link.href}
              href={link.href}
              onClick={close}
              role="menuitem"
              className={dropdownItemClass}
              activeClassName="bg-gray-100 text-gray-900"
            >
              {link.label}
            </NavLink>
          ))}
          <div className="my-1 border-t border-gray-100" />
          {userName ? (
            <>
              <span className="block px-4 py-2 text-xs text-gray-500 truncate">{userName}</span>
              <AccountMenuItems isAdmin={isAdmin} onSelect={close} />
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
//
// 並ぶ項目はすべて whitespace-nowrap。パンくずを持つページ（投稿詳細など）では横幅の取り合いに
// なり、折り返しを許すと「投稿する」が2〜3行になってヘッダーの高さごと崩れる。
// 詰まったときに縮む・切れるのはパンくず側（site-header.tsx の min-w-0 + truncate）。
export function HeaderNav({
  userName,
  isAdmin = false,
}: {
  userName: string | null;
  /** ADMIN のときだけユーザーメニューに管理画面リンクを出す（表示の出し分けであって認可ではない） */
  isAdmin?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3">
      {/* デスクトップの情報ページリンク（sm 以上）。現在地は背景色＋太字＋aria-current で示す。
          主 CTA「投稿する」は現在地表示の対象にしない（ナビ項目ではなくボタンで、
          /submit に居ることは見出しで分かるため） */}
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          className="hidden sm:block whitespace-nowrap rounded-md px-2 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          activeClassName="bg-gray-100 text-gray-900"
        >
          {link.label}
        </NavLink>
      ))}

      {/* デスクトップの認証状態（sm 以上） */}
      {userName ? (
        <DesktopUserMenu userName={userName} isAdmin={isAdmin} />
      ) : (
        <>
          <Link
            href={routes.register}
            className="hidden sm:block whitespace-nowrap text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            会員登録
          </Link>
          {/* 塗りは主 CTA「投稿する」（青）に譲り、ログインは枠線で階層を下げる */}
          <Link
            href={routes.login}
            className="hidden sm:block whitespace-nowrap text-sm text-gray-700 border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            ログイン
          </Link>
        </>
      )}

      {/* 主 CTA（常時表示） */}
      <Link
        href={routes.submit}
        className="whitespace-nowrap text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-500 transition-colors"
      >
        投稿する
      </Link>

      <MobileMenu userName={userName} isAdmin={isAdmin} />
    </div>
  );
}
