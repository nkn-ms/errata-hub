import { test, expect, type Page } from "@playwright/test";
import { login } from "./login";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { createThrowawayReport, deleteReportAsAdmin } from "./throwaway-report";

const SEED_PUBLISHER = "オーム社"; // シードが作る唯一の出版社（使い捨て投稿の本Bの出版社でもある）

/** 管理画面でステータスを変える（回答は「未対応」以外でないと書けない＝規約 第8条2項） */
async function setStatus(page: Page, reportId: string, label: string) {
  await page.goto(`/admin/reports/${reportId}`);
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByText("更新しました")).toBeVisible();
}

/** 出版社アクセスの付与・剥奪（確定ボタンまで押す = PR#198 の作法） */
async function setPublisherAccess(page: Page, grant: boolean) {
  await page.goto("/admin/users");
  await page
    .getByRole("row")
    .filter({ hasText: READER.email })
    .getByRole("link", { name: "編集" })
    .click();
  await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);

  if (grant) {
    await page.getByRole("combobox").selectOption({ label: SEED_PUBLISHER });
    await page.getByRole("button", { name: "追加", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "権限を外す" }).click();
  }
  await page.getByRole("button", { name: "アクセス権を更新する" }).click();
  await expect(page.getByText("更新しました")).toBeVisible();
}

const COMMENT_FORM = "出版社として回答する";

/** 回答フォームに絞る。⚠️ 投稿者本人が開くと追記フォームにも「確認する」があるため */
function commentForm(page: Page) {
  return page.locator("form").filter({ has: page.getByLabel(COMMENT_FORM) });
}

/**
 * 保存された回答の一覧に絞る。
 * ⚠️ **ページ全体で本文を探さない。** 送る前の確認ダイアログにも同じ本文が入るので、
 * それに一致すると「保存される前に通ってしまう」（実際にそうなり、続く reload が
 * まだ書き込み中の Server Action と競合して落ちた）。
 */
function savedAnswers(page: Page) {
  return page.getByRole("region", { name: "出版社からの回答" });
}

test.describe("出版社からの回答", () => {
  test("未対応の間は誰も書けず、連絡後は運営者が代理で回答できる（削除も運営者だけ）", async ({
    page,
  }) => {
    const title = `E2E出版社回答テスト ${Date.now()}`;
    const body = `E2E 第3刷で修正します ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);

    // 未対応（PENDING）の間は投稿者が本文を直せるので、管理者であっても回答できない
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByLabel(COMMENT_FORM)).toHaveCount(0);

    await setStatus(page, reportId, "出版社へ連絡済み");

    // 連絡後は回答欄が出る。管理者は権限を持たないので「代理で記載」になる
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByLabel(COMMENT_FORM)).toBeVisible();
    await expect(page.getByText("運営者が代理で記載します")).toBeVisible();

    // 取り消せない操作なので確認ダイアログを挟む（追記・新規投稿と同じ形）
    await page.getByLabel(COMMENT_FORM).fill(body);
    await commentForm(page).getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "この内容で回答します" })).toBeVisible();
    await page.getByRole("button", { name: "回答する" }).click();

    // 代理記載であることが公開ページに出る（規約 第8条4項の明示義務）
    await expect(savedAnswers(page).getByText(body)).toBeVisible();
    await expect(savedAnswers(page)).toContainText(SEED_PUBLISHER);
    await expect(savedAnswers(page)).toContainText("運営者が代理で記載");

    // 書いた本人でも取り消せない（規約 第8条3項）＝公開ページに削除の手立ては無い
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);

    // リロードしても残る（クライアントの一覧に足しただけでなく保存されている）
    await page.reload();
    await expect(savedAnswers(page).getByText(body)).toBeVisible();

    // 消せるのは運営者のモデレーションだけ（規約 第10条1項）
    await page.goto(`/admin/reports/${reportId}`);
    await expect(page.getByText(body)).toBeVisible();
    await page.getByRole("button", { name: "この回答を削除" }).click();
    await expect(page.getByRole("heading", { name: "この回答を削除します" })).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("まだ回答はありません。")).toBeVisible();

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText(body)).toHaveCount(0);

    await deleteReportAsAdmin(page, reportId);
  });

  test("権限が無ければ回答欄は出ず、付与すると本人として回答できる", async ({ page }) => {
    const title = `E2E出版社権限テスト ${Date.now()}`;
    const body = `E2E 確認いたしました ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);
    await setStatus(page, reportId, "出版社へ連絡済み");

    // 権限の無い一般ユーザーには入力欄自体が出ない
    await login(page, READER);
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByLabel(COMMENT_FORM)).toHaveCount(0);

    await login(page, ADMIN);
    await setPublisherAccess(page, true);

    // 付与された本人は「代理」ではなく出版社本人として書ける
    await login(page, READER);
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByLabel(COMMENT_FORM)).toBeVisible();
    await expect(page.getByText("運営者が代理で記載します")).toHaveCount(0);

    await page.getByLabel(COMMENT_FORM).fill(body);
    await commentForm(page).getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "回答する" }).click();

    await expect(savedAnswers(page).getByText(body)).toBeVisible();
    await expect(savedAnswers(page)).toContainText(SEED_PUBLISHER);
    await expect(savedAnswers(page)).not.toContainText("運営者が代理で記載");

    // リロードしても残る（クライアントの一覧に足しただけでなく保存されている）
    await page.reload();
    await expect(savedAnswers(page).getByText(body)).toBeVisible();

    // 後片付け（権限を残すと他のテストの前提が変わる）
    await login(page, ADMIN);
    await setPublisherAccess(page, false);
    await deleteReportAsAdmin(page, reportId);
  });
});
