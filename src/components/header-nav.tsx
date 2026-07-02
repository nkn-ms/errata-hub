"use client";

import { useState } from "react";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { logout } from "@/app/actions/auth";

// ヘッダー右側のナビ。デスクトップはインライン表示、モバイル（sm 未満）は
// ハンバーガーメニューに集約する。主 CTA「投稿する」だけは常時表示。
export function HeaderNav({ userName }: { userName: string | null }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative flex items-center gap-3">
      {/* デスクトップナビ（sm 以上） */}
      <Link
        href={routes.howToUse}
        className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        使い方
      </Link>
      <Link
        href={routes.tech}
        className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        使用技術
      </Link>
      {userName ? (
        <>
          <Link
            href={routes.account}
            className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            アカウント
          </Link>
          <span className="hidden sm:block text-xs text-gray-500">{userName}</span>
          <form action={logout} className="hidden sm:block">
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ログアウト
            </button>
          </form>
        </>
      ) : (
        <>
          <Link
            href={routes.register}
            className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            会員登録
          </Link>
          <Link
            href={routes.login}
            className="hidden sm:block text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
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

      {/* ハンバーガー（sm 未満のみ） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
        aria-expanded={open}
        className="sm:hidden inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
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
      </button>

      {/* モバイルメニュー（ドロップダウン） */}
      {open && (
        <div className="sm:hidden absolute right-0 top-full mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <Link
            href={routes.howToUse}
            onClick={close}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            使い方
          </Link>
          <Link
            href={routes.tech}
            onClick={close}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            使用技術
          </Link>
          <div className="my-1 border-t border-gray-100" />
          {userName ? (
            <>
              <span className="block px-4 py-2 text-xs text-gray-500 truncate">{userName}</span>
              <Link
                href={routes.account}
                onClick={close}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                アカウント
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href={routes.register}
                onClick={close}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                会員登録
              </Link>
              <Link
                href={routes.login}
                onClick={close}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                ログイン
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
