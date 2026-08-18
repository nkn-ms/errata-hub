import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HeaderNav } from "./header-nav";

// ログアウトは Server Action なのでテストではモジュールごとモックする
vi.mock("@/features/account/actions/auth", () => ({ logout: vi.fn() }));
// ナビは現在地の判定に usePathname を使う（NavLink）。テストでは Next のルーターが
// 立っていないので、どのページに居るかをここで決める
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(() => {
  cleanup();
});

// デスクトップのユーザーメニューは表示名クリックで開く
function openUserMenu(userName: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(userName) }));
}

describe("HeaderNav の管理画面リンク", () => {
  it("ADMIN のユーザーメニューには管理画面が出る", () => {
    render(<HeaderNav userName="管理者" isAdmin />);
    openUserMenu("管理者");

    expect(screen.getByRole("menuitem", { name: "管理画面" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "アカウント設定" })).toBeTruthy();
  });

  it("一般ユーザーのメニューには出さない（押せないリンクを見せない）", () => {
    render(<HeaderNav userName="読者" />);
    openUserMenu("読者");

    expect(screen.queryByRole("menuitem", { name: "管理画面" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "アカウント設定" })).toBeTruthy();
  });

  it("未ログインではユーザーメニュー自体が無く、管理画面も出ない", () => {
    render(<HeaderNav userName={null} isAdmin />);

    expect(screen.queryByRole("menuitem", { name: "管理画面" })).toBeNull();
    expect(screen.getByRole("link", { name: "ログイン" })).toBeTruthy();
  });

  it("モバイルメニュー（ハンバーガー）にも同じ出し分けが効く", () => {
    render(<HeaderNav userName="管理者" isAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));

    expect(screen.getByRole("menuitem", { name: "管理画面" })).toBeTruthy();
  });
});
