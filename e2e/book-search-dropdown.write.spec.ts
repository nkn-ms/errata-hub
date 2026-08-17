import { test, expect } from "@playwright/test";
import { SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";

// タイトル検索の候補リスト（combobox のドロップダウン）の幅を測る。
//
// なぜ e2e なのか: これは「absolute の基準になる祖先がどれか」で決まる**レイアウトの問題**で、
// unit テストでは測れない。実際に一度壊れており（候補リストが relative の外に置かれていて
// w-full がビューポート幅として解決され、入力欄からはみ出したうえページに横スクロールが出た）、
// マークアップを動かすと静かに再発しうるので、幅そのものを assertion にする。
//
// 外部書誌API（Google Books / OpenBD）はモックする。測るのは表示だけで、
// 外部依存で flaky にする理由が無い。
const LONG_TITLED_BOOKS = [
  { title: "Google Apps Script Webアプリ開発超入門", author: "掌田,津耶乃", publisher: "秀和システム", isbn: "9784798062404" },
  { title: "Office ScriptによるExcel on the web開発入門", author: "掌田,津耶乃", publisher: "ラトルズ", isbn: "9784899774976" },
  { title: "WebAssembly System Interface入門", author: "八木 明日香", publisher: "インプレス NextPublishing", isbn: "9784295602651" },
];

test.describe("タイトル検索の候補リスト（書き込み・ログイン必須）", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/books/search*", (route) =>
      route.fulfill({
        json: {
          items: LONG_TITLED_BOOKS.map((b, i) => ({
            id: `stub-${i}`,
            volumeInfo: {
              title: b.title,
              authors: [b.author],
              publisher: b.publisher,
              industryIdentifiers: [{ type: "ISBN_13", identifier: b.isbn }],
            },
          })),
        },
      })
    );
    // 書誌の補正（enrichWithOpenBD）。ここでは Google の値をそのまま使わせる
    await page.route("**/api/books/openbd*", (route) => route.fulfill({ json: [] }));

    await login(page, READER);
  });

  test("候補リストの幅は入力欄に揃い、ページに横スクロールを作らない", async ({ page }) => {
    await page.goto("/submit");
    await page.getByRole("button", { name: "タイトルで検索" }).click();

    const input = page.getByPlaceholder("書籍名・著者名で検索...");
    await input.fill("web");

    // 候補が開くまで待つ（入力は 400ms のデバウンス後に検索する）
    const firstOption = page.getByRole("button", { name: /WebAssembly System Interface入門/ });
    await expect(firstOption).toBeVisible();

    const inputBox = await input.boundingBox();
    const dropdownBox = await firstOption.locator("xpath=..").boundingBox();
    expect(inputBox).not.toBeNull();
    expect(dropdownBox).not.toBeNull();

    // 入力欄と同じ幅・同じ左端。1px 未満のズレは小数の丸めなので許容する
    expect(Math.abs(dropdownBox!.width - inputBox!.width)).toBeLessThan(1);
    expect(Math.abs(dropdownBox!.x - inputBox!.x)).toBeLessThan(1);

    // はみ出しの結果として出るページ全体の横スクロールも直接見る
    // （幅が合っていても position の基準を間違えると再発しうるため、症状の側からも縛る）
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
