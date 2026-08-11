import { expect, type Page } from "@playwright/test";
import { confirmAndSubmit } from "./submit-report";
import { openReportByTitle } from "./find-report";

// 使い捨ての投稿を作る・消すための道具。
//
// ⭐ **シードの「サンプル投稿」を借りるテストにしない。** ローカルで手動確認のついでに
// その投稿を消す・ステータスを変える・同じ本に別の投稿を足す、のどれか1つで落ちる（実際に落ちた）。
// さらに `prisma/seed.ts` は決まった id で作り直すようになる前は「本Aに投稿が0件のときだけ」
// 作っていたので、一度壊すと seed を流し直しても戻らなかった。
// 各テストが自分の投稿を作って自分で消せば、**ローカルの DB に何が入っていても影響を受けない**。
//
// 使い捨ての投稿は「投稿0件で始まる本」（シードの本B）に作る。本Aはシードのサンプル投稿が居る側で、
// そちらに足すと「本Aの投稿は1件」を前提にした手動確認が狂う。

export const THROWAWAY_BOOK = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

// 本文（誤 / 正）。「却下しても本文を伏せない」ことを見るテストがこの文字列を探す
export const THROWAWAY_WRONG = "正字コード";
export const THROWAWAY_CORRECT = "文字コード";

/** 書籍検索を外部 API に行かせない（オフラインでも動き、外部の在庫状況に左右されない） */
export async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [
        {
          summary: {
            isbn: THROWAWAY_BOOK.isbn,
            title: THROWAWAY_BOOK.title,
            author: THROWAWAY_BOOK.author,
            publisher: THROWAWAY_BOOK.publisher,
            cover: "",
          },
        },
      ],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

/**
 * 使い捨ての投稿を1件作り、その id を返す。**ログイン済みのページで呼ぶこと**
 * （誰で作るかは呼び出し側の都合＝投稿者の操作を見るなら READER、管理操作だけ見るなら ADMIN）。
 */
export async function createThrowawayReport(page: Page, title: string): Promise<string> {
  await mockBookApis(page);
  await page.goto("/submit");
  await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(THROWAWAY_BOOK.isbn);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.getByText(THROWAWAY_BOOK.title)).toBeVisible();

  await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
  await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
  await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(title);
  await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill(THROWAWAY_WRONG);
  await page.getByPlaceholder("正しいと思われる内容を入力してください").fill(THROWAWAY_CORRECT);
  await confirmAndSubmit(page);
  await page.waitForURL(/\/$/);

  return openReportByTitle(page, title);
}

/** 後片付け。**管理者のページで呼ぶこと** */
export async function deleteReportAsAdmin(page: Page, reportId: string) {
  await page.goto(`/admin/reports/${reportId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.waitForURL(/\/admin\/reports$/);
}
