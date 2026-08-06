import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { openReportByTitle } from "./find-report";
import { confirmAndSubmit } from "./submit-report";

// 書き込み系（投稿・賛同）の e2e。ローカル dev＋ローカル Supabase 限定で実行される
// （playwright.config.ts の write-local project は BASE_URL がローカルのときだけ有効）。
//
// 前提: `supabase start` ＋ `npm run seed:local` 済みであること。
//   - シードアカウント: admin@local.test（管理者・「サンプル投稿」の投稿者）
//                       reader@local.test（一般ユーザー）
//   - シード本B「マスタリングTCP/IP 入門編」は投稿0件（このテストで作成→削除して0件に戻す）
//
// 外部書誌API（OpenBD / Google Books）はモックする。書誌データの取得自体はテスト対象外で、
// 外部依存によるflakinessを避けるため。

// シードの本B（投稿なし）。投稿作成テストで使い、終了時に投稿を削除して元の状態に戻す。
const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

// 管理者がシードで作る投稿（賛同テストの対象＝reader から見て「他人の投稿」）。
const SEEDED_REPORT_TITLE = "サンプル投稿";

// ISBN検索が叩く書誌APIをシード本Bの応答で差し替える
async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  // OpenBD に書影が無いときの Google Books フォールバック（書影なしで応答）
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

test.describe("投稿フォーム（書き込み）", () => {
  test("書籍未選択で投稿するとエラーが表示され、押すと検索欄へ飛ぶ", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("書籍を選択してください")).toBeVisible();

    await page.getByRole("link", { name: "書籍を選択してください" }).click();
    await expect(page.getByPlaceholder("例: 9784873116860", { exact: true })).toBeFocused();
  });

  // 検証は1件ずつ出さず全部まとめて出す（1件ずつだと「押す→直す→また押す」を繰り返させる）。
  // 読み上げ環境ではフォーカスが押したボタンに残るため、role="alert" が無いと何も知らされない。
  test("投稿時のエラーは全件まとまって出て、押すと該当欄へ飛ぶ", async ({ page }) => {
    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    // 何も入れずに投稿＝紙の必須（版・ページ）＋タイトル＋誤＋正 の5件が一度に出る
    await page.getByRole("button", { name: "確認する" }).click();

    // ⚠️ Next.js が挿入するルートアナウンサー（#__next-route-announcer__）も role="alert" なので、
    //    フォーム内に限定して指す（素の getByRole("alert") は2件に当たって strict mode 違反になる）
    const summary = page.locator('form [role="alert"]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("5件の入力を直してください");
    // 並び順は画面の並び（版 → タイトル → ページ番号 → 誤 → 正）。全項目がリンクであること
    await expect(summary.getByRole("link")).toHaveCount(5);
    await expect(summary.getByRole("listitem")).toHaveText([
      "版を入力してください",
      "タイトルを入力してください",
      "ページ番号を入力してください",
      "誤（該当箇所）を入力してください",
      "正（正しい内容）を入力してください",
    ]);

    // 項目を押すとその入力欄へフォーカスが移る（長いフォームで探させない）
    await summary.getByRole("link", { name: "ページ番号を入力してください" }).click();
    await expect(page.getByLabel("ページ番号")).toBeFocused();

    // 直した項目は消え、残りだけが出る（1件になったら箇条書きにしない）
    await page.getByLabel("ページ番号").fill("42");
    await page.getByLabel(/^版/).fill("1");
    await page.getByLabel("タイトル").fill("E2Eエラー集約の確認");
    await page.getByLabel("誤（該当箇所）").fill("誤った文");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(summary).toHaveText("正（正しい内容）を入力してください");
  });

  // 確認画面は「送る内容を見せる」ためのものなので、出ていることではなく
  // **入力した値がそのまま出ていること**を測る。あわせて、この段では投稿が作られないことも見る
  // （確認しただけで投稿されるなら、確認画面である意味が無い）。
  test("確認画面に入力内容が出て、修正するで戻ると入力が残っている", async ({ page }) => {
    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("2"); // 版
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42"); // ページ番号
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill("E2E確認画面");
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("正字コード");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("文字コード");

    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "この内容で投稿します" })).toBeVisible();

    // フォームは畳まれている（＝確認中に入力が変わることがない）
    await expect(page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true })).toHaveCount(0);

    // 入力した値が並ぶ。版・刷とページは組み立てて出すので、組み立てた形で見る
    const summary = page.getByRole("definition");
    await expect(summary.filter({ hasText: BOOK_B.title })).toBeVisible();
    await expect(summary.filter({ hasText: "第2版" })).toBeVisible();
    await expect(summary.filter({ hasText: "p.42" })).toBeVisible();
    await expect(summary.filter({ hasText: "E2E確認画面" })).toBeVisible();
    await expect(summary.filter({ hasText: "正字コード" })).toBeVisible();
    await expect(summary.filter({ hasText: "文字コード" })).toBeVisible();
    // 入力していない任意の欄は行ごと出さない（未入力の行が並ぶと書いた内容が埋もれる）
    await expect(page.getByText("備考", { exact: true })).toHaveCount(0);

    // 投稿ボタンはフォームの下端にある。畳んだだけだとスクロール位置が下に残り、
    // 確認画面がヘッダーの下に潜る。先頭まで戻していること（画像の失敗パネルと同じ手当て）
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // 「修正する」でフォームへ戻る。打ち込んだ内容は残っている（確認のたびに書き直させない）
    await page.getByRole("button", { name: "修正する" }).click();
    await expect(page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true })).toHaveValue(
      "E2E確認画面"
    );
    await expect(page.getByPlaceholder("例: 1", { exact: true })).toHaveValue("2");

    // ここまでで投稿は作られていない（確認しただけでは送られない）
    await page.goto(`/books/${BOOK_B.isbn}`);
    await expect(page.getByText("E2E確認画面")).toHaveCount(0);
  });

  test("文字数カウンターは上限の8割に達してから出る", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");

    // 空のうちは出さない（上限の数字をアンカーにしないため）
    await expect(page.locator("#title-count")).toBeHidden();
    await expect(page.locator("#note-count")).toBeHidden();

    // 既定は正誤（ERRATA）＝「誤」「正」の欄が出る
    const wrong = page.getByLabel("誤（該当箇所）");
    const wrongCount = page.locator("#wrong-count");
    await expect(wrongCount).toBeHidden();

    // 8割に届かないうちは出ない
    await wrong.fill("あ".repeat(30));
    await expect(wrongCount).toBeHidden();

    // 8割（1000 × 0.8）に達したら出る
    await wrong.fill("あ".repeat(800));
    await expect(wrongCount).toBeVisible();
    await expect(wrongCount).toHaveText("800/1000");

    // 実際の打ち切りはブラウザの maxlength が行う（fill は DOM に直接代入するので
    // maxlength を経由しない＝ここでは属性が付いていることだけを確かめる）
    await expect(wrong).toHaveAttribute("maxlength", "1000");

    // 隣の「正」欄は空のままなので出ない（欄ごとに独立している）
    await expect(page.locator("#correct-count")).toBeHidden();

    // 改善提案に切り替えると「内容・提案」欄（上限1000）のカウンターに変わる
    await page.getByRole("button", { name: "改善提案" }).click();
    const contentCount = page.locator("#content-count");
    await expect(contentCount).toBeHidden();
    await page.getByLabel("内容・提案").fill("あ".repeat(800));
    await expect(contentCount).toHaveText("800/1000");
  });

  test("紙の書籍の正誤投稿が作成でき、一覧と詳細に反映される", async ({ page, browser }) => {
    const uniqueTitle = `E2E投稿テスト ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    // ISBN検索（既定モード）でシード本Bを選択
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    // 紙の必須項目（版・ページ）＋タイトル・正誤を入力
    await page.getByPlaceholder("例: 1", { exact: true }).fill("1"); // 版
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42"); // ページ番号
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("正字コード");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("文字コード");

    // 投稿は Server Action 経由（応答は JSON ではない）ので、成功はトップへの遷移で確認する
    await confirmAndSubmit(page);
    await page.waitForURL(/\/$/);

    // 検索一覧（/reports）に新しい投稿が出て、行クリックで詳細へ入れる。
    // 入力した内容が表示される。投稿 id は URL から取得（後片付けで使う）
    const reportId = await openReportByTitle(page, uniqueTitle);
    await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
    await expect(page.getByText("正字コード")).toBeVisible();
    await expect(page.getByText("文字コード")).toBeVisible();

    // 後片付け: 管理画面の削除ボタンで削除し、本Bを「投稿0件」というシードの前提に戻す。
    // （途中のassert失敗時は残るが、ローカルDBなので seed し直せばよい）
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    // 削除アクションは成功時に一覧へ redirect する
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });

  test("「誤の内容をコピー」で正に全文が入り、直さず投稿すると弾かれる", async ({ page }) => {
    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    const wrong = page.getByPlaceholder("誤りのある文章をそのまま入力してください");
    const correct = page.getByPlaceholder("正しいと思われる内容を入力してください");
    const copyButton = page.getByRole("button", { name: "誤の内容をコピー" });

    // 誤が空のうちは押せない（コピーするものが無い）
    await expect(copyButton).toBeDisabled();

    await wrong.fill("RFC 822, updated by RFC 6854");
    await copyButton.click();
    await expect(correct).toHaveValue("RFC 822, updated by RFC 6854");

    // 打ち込んだ内容を黙って上書きしない＝正が埋まっている間は押せない
    await expect(copyButton).toBeDisabled();

    // コピーしたまま（＝直し忘れ）で投稿すると弾かれる。他の項目と同じく投稿時にまとめて出す
    await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill("E2Eコピー確認");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("誤と正が同じ内容です。正しい内容に直してください")).toBeVisible();
    // 投稿は成立していない（トップへ遷移しない）
    await expect(page).toHaveURL(/\/submit/);
  });

  // 全角のまま送れてしまうと投稿できない（Number() が NaN になる）。IME の確定の仕方で全角が残る
  // ことがあり、本番の実投稿で「数字を入力してください」で止まった（2026-07-28）ので実ブラウザで固定する。
  // ▲▼ での増減も、type="number" から自前実装に置き換えたので同じテストで担保する。
  test("数値欄は全角で入れても半角として投稿でき、▲▼で増減できる", async ({ page, browser }) => {
    const uniqueTitle = `E2E全角数字テスト ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    const edition = page.getByPlaceholder("例: 1", { exact: true });
    const pageNumber = page.getByPlaceholder("例: 42", { exact: true });

    // 版は ▲ を押して入れる（未入力から押すと下限の 1 になる）
    await edition.click();
    await page.locator('#edition ~ div button[title="1増やす"]').click();
    await expect(edition).toHaveValue("1");
    // 押した後もフォーカスは入力欄に残る（そのまま打ち続けられる＝ネイティブと同じ操作感）
    await expect(edition).toBeFocused();

    // ページ番号は全角で入力し、フォーカスが外れた時点で半角になる
    await pageNumber.fill("１４１");
    await pageNumber.blur();
    await expect(pageNumber).toHaveValue("141");

    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("全角の誤");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("全角の正");
    await confirmAndSubmit(page);
    await page.waitForURL(/\/$/);

    // 半角の数値として保存されている（位置の表示が "第1版 p.141"）
    const reportId = await openReportByTitle(page, uniqueTitle);
    await expect(page.getByText("p.141")).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });

  test("書籍ページの「この本に投稿する」から入ると、書籍を選び直さずに投稿できる", async ({ page, browser }) => {
    const uniqueTitle = `E2E確定書籍テスト ${Date.now()}`;

    await login(page, READER);
    await page.goto(`/books/${BOOK_B.isbn}`);
    await page.getByRole("link", { name: "この本に投稿する" }).click();
    await page.waitForURL(/\/submit\?isbn=/);

    // 書籍は確定表示。検索させられない（＝この導線の目的）
    await expect(page.getByText(BOOK_B.title)).toBeVisible();
    await expect(page.getByText(`ISBN: ${BOOK_B.isbn}`)).toBeVisible();
    await expect(page.getByPlaceholder("例: 9784873116860", { exact: true })).toHaveCount(0);
    // 逃げ道は残っている
    await expect(page.getByRole("link", { name: "別の本を選ぶ" })).toBeVisible();

    // 版・刷は書籍データではなく投稿ごとの値なので、確定表示でも入力できる
    await page.getByPlaceholder("例: 1", { exact: true }).fill("2");
    await page.getByPlaceholder("例: 42", { exact: true }).fill("15");
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った記述");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい記述");
    await confirmAndSubmit(page);
    await page.waitForURL(/\/$/);

    // 検索し直していないのに、正しい本に紐づいている
    await page.goto(`/books/${BOOK_B.isbn}`);
    await expect(page.getByText(uniqueTitle)).toBeVisible();

    // 後片付け: 本Bを「投稿0件」というシードの前提に戻す
    await page.getByText(uniqueTitle).click();
    await page.waitForURL(/\/reports\/[^/]+$/);
    const reportId = page.url().split("/").pop()!;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });

  test("未登録・不正な ISBN で /submit を開いても 404 にせず通常の投稿フォームを出す", async ({ page }) => {
    await login(page, READER);
    // チェック数字が不正な ISBN（＝そもそも本を特定できない）
    await page.goto("/submit?isbn=9784873116861");
    await expect(page.getByRole("heading", { name: "投稿する" })).toBeVisible();
    // 書籍検索が出ている＝通常のフォームにフォールバックしている
    await expect(page.getByPlaceholder("例: 9784873116860", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "別の本を選ぶ" })).toHaveCount(0);
  });
});

test.describe("賛同（書き込み）", () => {
  // シード投稿の詳細ページを開く
  async function openSeededReport(page: Page) {
    await openReportByTitle(page, SEEDED_REPORT_TITLE);
  }

  test("他人の投稿に賛同でき、取り消すと元に戻る", async ({ page }) => {
    await login(page, READER);
    await openSeededReport(page);

    const button = page.getByRole("button", { name: /自分も見つけた/ });
    await expect(button).toBeEnabled();
    const countSpan = button.locator("span").last();
    const initialCount = Number(await countSpan.textContent());
    // 以前の実行の状態が残っていても通るよう、初期状態から±1のトグルとして検証する
    const initiallyUpvoted = (await button.getAttribute("title")) === "賛同を取り消す";

    await button.click();
    await expect(countSpan).toHaveText(String(initialCount + (initiallyUpvoted ? -1 : 1)));

    await button.click();
    await expect(countSpan).toHaveText(String(initialCount));
  });

  test("自分の投稿には賛同できない（ボタンが無効）", async ({ page }) => {
    await login(page, ADMIN);
    await openSeededReport(page);

    const button = page.getByRole("button", { name: /自分も見つけた/ });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "自分の投稿には賛同できません");
  });
});
