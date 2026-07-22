import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminUserEditor from "./user-editor";
import type { Profile, Publisher, PublisherAccess } from "@/generated/prisma/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Server Action はネットワーク越しの呼び出しになるため、テストではモジュールごとモックする
const updateUserRoleMock = vi.fn();
const grantPublisherAccessMock = vi.fn();
const revokePublisherAccessMock = vi.fn();
const withdrawUserAsAdminMock = vi.fn();
vi.mock("@/app/actions/user", () => ({
  updateUserRole: (...args: unknown[]) => updateUserRoleMock(...args),
  grantPublisherAccess: (...args: unknown[]) => grantPublisherAccessMock(...args),
  revokePublisherAccess: (...args: unknown[]) => revokePublisherAccessMock(...args),
  withdrawUserAsAdmin: (...args: unknown[]) => withdrawUserAsAdminMock(...args),
}));

const now = new Date("2026-07-13T00:00:00Z");

const publisherA: Publisher = {
  id: "pub-a",
  name: "技術評論社",
  email: null,
  emailDomain: null,
  note: null,
  createdAt: now,
  updatedAt: now,
};
const publisherB: Publisher = { ...publisherA, id: "pub-b", name: "オライリー" };

const accessToA: PublisherAccess & { publisher: Publisher } = {
  id: "acc-1",
  profileId: "user-1",
  publisherId: publisherA.id,
  createdAt: now,
  publisher: publisherA,
};

const profile: Profile & { publisherAccess: (PublisherAccess & { publisher: Publisher })[] } = {
  id: "user-1",
  email: "user@example.com",
  displayName: "テスト太郎",
  githubUsername: null,
  xUsername: null,
  role: "USER",
  termsAgreedAt: now,
  termsVersion: "2026-07-22",
  createdAt: now,
  updatedAt: now,
  publisherAccess: [accessToA],
};

function renderEditor(withdrawBlockedReason: string | null = null) {
  return render(
    <AdminUserEditor
      profile={profile}
      publishers={[publisherA, publisherB]}
      withdrawBlockedReason={withdrawBlockedReason}
    />
  );
}

const withdrawButton = () => screen.getByRole("button", { name: "退会させる" });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AdminUserEditor", () => {
  describe("出版社アクセスの削除", () => {
    it("サーバーが失敗を返したら一覧から消さず、エラーを表示する", async () => {
      revokePublisherAccessMock.mockResolvedValue({ error: "削除に失敗しました" });
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "削除" }));

      await waitFor(() => expect(screen.getByText("削除に失敗しました")).toBeTruthy());
      // 権限は剥奪できていないので、画面にも残っていなければならない
      expect(screen.getByText(publisherA.name)).toBeTruthy();
      expect(screen.queryByText("削除しました")).toBeNull();
    });

    it("成功したら一覧から消える", async () => {
      revokePublisherAccessMock.mockResolvedValue({});
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "削除" }));

      await waitFor(() => expect(screen.getByText("削除しました")).toBeTruthy());
      // 付与一覧（li）から消える。※剥奪した出版社は「未付与」に戻るので select の選択肢には現れる
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.getByText("付与された出版社なし")).toBeTruthy();
      expect(revokePublisherAccessMock).toHaveBeenCalledWith(profile.id, publisherA.id);
    });
  });

  describe("出版社アクセスの追加", () => {
    it("サーバーが失敗を返したら一覧に足さず、エラーを表示する", async () => {
      grantPublisherAccessMock.mockResolvedValue({ error: "追加に失敗しました" });
      renderEditor();

      fireEvent.change(screen.getByRole("combobox"), { target: { value: publisherB.id } });
      fireEvent.click(screen.getByRole("button", { name: "追加" }));

      await waitFor(() => expect(screen.getByText("追加に失敗しました")).toBeTruthy());
      // 付与できていないので、一覧（li）には現れない
      expect(screen.queryByRole("listitem", { name: publisherB.name })).toBeNull();
      expect(screen.queryByText("追加しました")).toBeNull();
    });

    it("成功したら一覧に追加される", async () => {
      grantPublisherAccessMock.mockResolvedValue({
        access: { id: "acc-2", profileId: profile.id, publisherId: publisherB.id, createdAt: now, publisher: publisherB },
      });
      renderEditor();

      fireEvent.change(screen.getByRole("combobox"), { target: { value: publisherB.id } });
      fireEvent.click(screen.getByRole("button", { name: "追加" }));

      await waitFor(() => expect(screen.getByText("追加しました")).toBeTruthy());
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(grantPublisherAccessMock).toHaveBeenCalledWith(profile.id, publisherB.id);
    });
  });

  describe("ロールの保存", () => {
    it("サーバーが失敗を返したらエラーを表示し、「保存しました」は出さない", async () => {
      updateUserRoleMock.mockResolvedValue({ error: "更新に失敗しました" });
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "管理者" }));
      fireEvent.click(screen.getByRole("button", { name: "ロールを保存" }));

      await waitFor(() => expect(screen.getByText("更新に失敗しました")).toBeTruthy());
      expect(screen.queryByText("保存しました")).toBeNull();
    });

    it("成功したら「保存しました」を出す", async () => {
      updateUserRoleMock.mockResolvedValue({});
      renderEditor();

      fireEvent.click(screen.getByRole("button", { name: "管理者" }));
      fireEvent.click(screen.getByRole("button", { name: "ロールを保存" }));

      await waitFor(() => expect(screen.getByText("保存しました")).toBeTruthy());
      expect(updateUserRoleMock).toHaveBeenCalledWith(profile.id, "ADMIN");
    });
  });

  describe("代行退会", () => {
    it("表示名を正しく入力するまでボタンを押せない（押し間違いの砦）", () => {
      renderEditor();
      expect(withdrawButton().hasAttribute("disabled")).toBe(true);

      // 1文字足りない状態ではまだ押せない
      fireEvent.change(screen.getByLabelText(/入力してください/), {
        target: { value: "テスト太" },
      });
      expect(withdrawButton().hasAttribute("disabled")).toBe(true);

      fireEvent.change(screen.getByLabelText(/入力してください/), {
        target: { value: profile.displayName! },
      });
      expect(withdrawButton().hasAttribute("disabled")).toBe(false);
    });

    it("実行できないユーザーには入力欄もボタンも出さず、理由を表示する", () => {
      renderEditor("自分自身を退会させることはできません。");

      expect(screen.getByText("自分自身を退会させることはできません。")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "退会させる" })).toBeNull();
      expect(screen.queryByLabelText(/入力してください/)).toBeNull();
    });

    it("サーバーが失敗を返したらエラーを表示し、画面に留まる", async () => {
      withdrawUserAsAdminMock.mockResolvedValue({ error: "このユーザーは既に退会済みです" });
      renderEditor();

      fireEvent.change(screen.getByLabelText(/入力してください/), {
        target: { value: profile.displayName! },
      });
      fireEvent.click(withdrawButton());

      await waitFor(() => expect(screen.getByText("このユーザーは既に退会済みです")).toBeTruthy());
      expect(withdrawUserAsAdminMock).toHaveBeenCalledWith(profile.id, profile.displayName);
      expect(withdrawButton()).toBeTruthy();
    });
  });
});
