import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN } from "./seed-accounts";
import { login } from "./login";
import { findReportRow, searchReports } from "./find-report";
import {
  createThrowawayReport,
  deleteReportAsAdmin,
  THROWAWAY_WRONG,
} from "./throwaway-report";

// ステータス運用の e2e。ローカル dev＋ローカル Supabase 限定（write-local project）。
// 前提は他の書き込みテストと同じ: `supabase start` ＋ `npm run seed:local` 済みであること。
//
// admin.write.spec.ts が「更新が公開ページに載る」ことを FIXED で1本通しているのに対し、
// ここは **ステータスごとの運用ルール**（schema.prisma の ReportStatus コメントと
// docs/moderation-policy.md）が実装されていることを担保する:
//   - OTHER（その他）は説明が無いと保存できない  = actions/report.ts の superRefine
//   - LISTED（正誤表に掲載）は公開側の絞り込みでも引ける
//   - DISMISSED（却下）でも投稿は消さない・隠さない
//   - 修正版・刷は FIXED を離れるとサーバー側で消える = ReportUpdateSchema の transform
//
// ⭐ **いずれも使い捨ての投稿を自分で作って自分で消す**（シードの投稿は借りない）。
//    借りていた頃は、ローカルで手動確認のついでにその投稿を触るだけで落ちた = e2e/throwaway-report.ts

// 管理画面で開く（作った直後は公開ページに居るので、操作する面へ移る）
async function openInAdmin(page: Page, reportId: string) {
  await page.goto(`/admin/reports/${reportId}`);
}

async function setStatus(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByText("更新しました")).toBeVisible();
}

test.describe("ステータス運用（管理者）", () => {
  test("「その他」は説明が無いと保存できず、書くと公開ページに出る", async ({ page }) => {
    const title = `E2Eその他テスト ${Date.now()}`;
    const note = `E2E その他の事情 ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);
    await openInAdmin(page, reportId);

    // 説明が空のまま「その他」で保存 → サーバー（superRefine）が弾く。
    // 「迷ったときの掃きだめ」にしないためのガードなので、UI ではなくサーバーで効くことに意味がある
    await setStatus(page, "その他");
    await page.getByLabel("運営者の補足").fill("");
    await page.getByRole("button", { name: "更新する" }).click();
    await expect(
      page.getByText("「その他」を選んだときは、運営者の補足欄に事情を記載してください")
    ).toBeVisible();
    await expect(page.getByText("更新しました")).toHaveCount(0);

    // 公開側はまだ変わっていない（弾かれたので未対応のまま）
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("未対応")).toBeVisible();

    // 説明を書けば保存でき、ステータスと説明が公開ページに出る
    await page.goto(`/admin/reports/${reportId}`);
    await setStatus(page, "その他");
    await page.getByLabel("運営者の補足").fill(note);
    await save(page);

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("その他", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();

    await deleteReportAsAdmin(page, reportId);
  });

  test("「正誤表に掲載」は投稿一覧のステータス絞り込みで引ける", async ({ page }) => {
    const title = `E2E掲載テスト ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);
    await openInAdmin(page, reportId);

    await setStatus(page, "正誤表に掲載");
    await save(page);

    // 公開ページ（詳細）に出る
    await page.goto(`/reports/${reportId}`);
    // バッジのラベルだけを見る（説明文にも「正誤表に掲載」が出てくるので完全一致で指す）
    await expect(page.getByText("正誤表に掲載", { exact: true })).toBeVisible();

    // 一覧（/reports）の絞り込みでも引ける。まず検索で対象を絞る
    // （一覧は10件ずつのページ送りなので、投稿が増えると素の /reports には出ない）。
    // ステータスは select の位置ではなく選択肢のラベルで指定する＝並び順が変わっても壊れない
    await searchReports(page, title);
    const statusFilter = page.locator("select").filter({ hasText: "ステータス：すべて" });
    await statusFilter.selectOption({ label: "正誤表に掲載" });
    await expect(findReportRow(page, title)).toBeVisible();

    // 別のステータスで絞ると消える（＝絞り込みが効いていることの裏取り）
    await statusFilter.selectOption({ label: "未対応" });
    await expect(findReportRow(page, title)).toHaveCount(0);

    await deleteReportAsAdmin(page, reportId);
  });

  test("「却下」しても投稿は公開のまま残る（削除も非公開もしない）", async ({ page }) => {
    const title = `E2E却下テスト ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);
    await openInAdmin(page, reportId);

    await setStatus(page, "却下");
    await save(page);

    // docs/moderation-policy.md の方針: 却下はラベルであって削除・非公開ではない。
    // 判断の履歴を読者にも見えるまま残す
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    // ⚠️ 完全一致で指す（投稿の概要にも「却下」が入るので、部分一致だと3つに当たる）
    await expect(page.getByText("却下", { exact: true })).toBeVisible();
    await expect(page.getByText(THROWAWAY_WRONG)).toBeVisible(); // 本文も伏せない

    // 一覧（検索）からも消えない
    await searchReports(page, title);
    await expect(findReportRow(page, title)).toBeVisible();

    await deleteReportAsAdmin(page, reportId);
  });

  test("修正版・刷は「修正済み」を離れるとサーバー側で消える", async ({ page }) => {
    const title = `E2E修正版テスト ${Date.now()}`;
    await login(page, ADMIN);
    const reportId = await createThrowawayReport(page, title);
    await openInAdmin(page, reportId);

    await setStatus(page, "修正済み");
    await page.getByLabel("修正済みの版").fill("2");
    await page.getByLabel("修正済みの刷").fill("3");
    await save(page);

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("第2版 第3刷より修正されました")).toBeVisible();

    // 「修正済み」以外へ変えると、入力欄が画面から消えるだけでなく保存値も落ちる
    // （ReportUpdateSchema の transform。UI の出し分けだけに頼らずサーバーが不変条件を守る）
    await page.goto(`/admin/reports/${reportId}`);
    await setStatus(page, "修正なし");
    await save(page);

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("より修正されました")).toHaveCount(0);

    // 「修正済み」に戻しても値は復活しない（＝消えているのは表示ではなくデータ）
    await page.goto(`/admin/reports/${reportId}`);
    await setStatus(page, "修正済み");
    await expect(page.getByLabel("修正済みの版")).toHaveValue("");
    await expect(page.getByLabel("修正済みの刷")).toHaveValue("");

    await deleteReportAsAdmin(page, reportId);
  });
});
