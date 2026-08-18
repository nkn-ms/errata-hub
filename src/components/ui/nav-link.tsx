"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 現在地が分かるナビのリンク。公開側ヘッダーと管理画面の帯で共用する。
//
// 現在地の判定は前方一致。詳細ページ（/admin/reports/[id]）は一覧（/admin/reports）の下位という
// 構造なので、詳細を見ている間も一覧の項目が現在地として点く方が「今どこにいるか」に素直に答える。
// 境界は "/" を含めて見る（"/admin/books" が "/admin/book-notes" に反応しないように）。
//
// ⚠️ 色だけで示さない（WCAG 1.4.1）。背景色に加えて文字を太くし、
//    支援技術には aria-current="page" で伝える（見た目だけの実装にしない）。
export function NavLink({
  href,
  children,
  className,
  activeClassName,
  onClick,
  role,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** 現在地のときだけ足す見た目（帯の配色が違うので呼び出し側から渡す） */
  activeClassName: string;
  /** モバイルメニューのように、選んだら閉じる呼び出し側で使う */
  onClick?: () => void;
  role?: string;
}) {
  const pathname = usePathname();
  const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      role={role}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(className, isCurrent && `font-medium ${activeClassName}`)}
    >
      {children}
    </Link>
  );
}
