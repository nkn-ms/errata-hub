import zlib from "node:zlib";
import { test, expect, type Page } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { openReportByTitle } from "./find-report";

// 画像添付つき投稿の e2e。ローカル dev＋ローカル Supabase 限定（write-local project）。
//
// 前提: `supabase start` ＋ `npm run seed:local` に加えて、**Storage バケットが必要**。
//   バケット report-images は supabase/config.toml に定義済みだが、`supabase start` だけでは
//   作られないことがある（実測）。無い場合は `supabase seed buckets` を実行する。
//
// 画像アップロードだけは Server Actions ではなく Route Handler（POST /api/reports/[id]/images）。
// Server Actions のボディ上限が既定 1MB のため（design.md §7）。この経路の回帰をここで止める。

const BOOK_B = {
  isbn: "9784274224478",
  title: "マスタリングTCP/IP 入門編",
  author: "井上,直也,1974-",
  publisher: "オーム社",
};

// 1x1 の PNG（テスト用の最小画像・70バイト）。画像生成ライブラリを足さずに済ませるための固定値で、
// PNG の最小構成 = シグネチャ8バイト（89 50 4e 47 0d 0a 1a 0a）＋ IHDR / IDAT / IEND チャンク。
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function mockBookApis(page: Page) {
  await page.route("**/api/books/openbd*", (route) =>
    route.fulfill({
      json: [{ summary: { isbn: BOOK_B.isbn, title: BOOK_B.title, author: BOOK_B.author, publisher: BOOK_B.publisher, cover: "" } }],
    })
  );
  await page.route("**/api/books/search*", (route) => route.fulfill({ json: { items: [] } }));
}

test.describe("画像添付つき投稿（書き込み）", () => {
  test("画像を添付して投稿でき、詳細ページに証拠画像が表示される", async ({ page, browser }) => {
    const uniqueTitle = `E2E画像テスト ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("1"); // 版
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42"); // ページ
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");

    // 画像を添付（選択直後にローカルプレビューが出る）
    await page.locator('input[type="file"]').setInputFiles({
      name: "errata.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(page.getByAltText("errata.png")).toBeVisible();

    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);

    // 詳細ページで「証拠画像」として表示される（＝Storage への保存と ReportImage 行の作成が成功している）
    const reportId = await openReportByTitle(page, uniqueTitle);

    const image = page.getByAltText("証拠画像");
    await expect(image).toBeVisible();
    // 画像は Supabase Storage の公開 URL を指す（バケット名まで確認する）
    await expect(image).toHaveAttribute("src", /report-images/);

    // 後片付け: 管理画面から削除（ReportImage と Storage 上のファイルも掃除される）
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });

  // 権利者から「この画像だけ消してほしい」と言われたときに、投稿を丸ごと消さずに応えるための機能
  // （docs/moderation-policy.md）。投稿本文が残ることまで含めて担保する。
  test("管理者は画像を1枚だけ削除でき、投稿本文は残る", async ({ page, browser }) => {
    const uniqueTitle = `E2E画像単体削除 ${Date.now()}`;

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");

    // 2枚添付して、片方だけ消えることを見る（1枚だと「投稿ごと消えた」と区別できない）
    await page.locator('input[type="file"]').setInputFiles([
      { name: "keep.png", mimeType: "image/png", buffer: PNG_1X1 },
      { name: "remove.png", mimeType: "image/png", buffer: PNG_1X1 },
    ]);
    await expect(page.getByAltText("keep.png")).toBeVisible();
    await expect(page.getByAltText("remove.png")).toBeVisible();

    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);
    const reportId = await openReportByTitle(page, uniqueTitle);
    await expect(page.getByAltText("証拠画像")).toHaveCount(2);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN);
      await adminPage.goto(`/admin/reports/${reportId}`);
      await expect(adminPage.getByAltText("添付画像")).toHaveCount(2);

      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "この画像を削除" }).first().click();
      await expect(adminPage.getByAltText("添付画像")).toHaveCount(1);

      // 操作ログに残る（権利者対応の証跡）
      await adminPage.goto("/admin/logs");
      await expect(adminPage.getByRole("row").filter({ hasText: "添付画像削除" }).first()).toBeVisible();

      // 公開側も1枚に減り、投稿そのもの（本文）は残っている
      await page.goto(`/reports/${reportId}`);
      await expect(page.getByAltText("証拠画像")).toHaveCount(1);
      await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
      await expect(page.getByText("誤った文")).toBeVisible();

      // 後片付け: 投稿ごと削除してシードの前提（本Bは投稿0件）に戻す
      await adminPage.goto(`/admin/reports/${reportId}`);
      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "削除", exact: true }).click();
      await adminPage.waitForURL(/\/admin\/reports$/);
    } finally {
      await adminContext.close();
    }
  });

  test("許可外の形式（テキストファイル）は添付できずエラーになる", async ({ page }) => {
    await login(page, READER);
    await page.goto("/submit");

    await page.locator('input[type="file"]').setInputFiles({
      name: "not-an-image.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("これは画像ではない"),
    });

    await expect(page.getByText("画像は JPEG / PNG / WebP のみ添付できます")).toBeVisible();
  });
});

// 1MB を超える PNG を作る。圧縮は「1MB 以下なら触らない」ので、閾値を超える画像でないと
// 圧縮経路そのものを通れない（= REPORT_IMAGE_SKIP_BYTES）。
//
// 画像生成ライブラリを足さずに済ませるため、PNG を手で組み立てる:
//  - deflate を level 0（無圧縮）にすると、出力サイズが生データとほぼ同じになる。
//    800x800 RGB = 約1.9MB になり、中身に関係なく閾値を超えられる
//  - 画素はなだらかなグラデーションにする。ランダムだと webp でも縮まず、
//    compressImage が「縮まなかったので元のまま返す」経路に落ちてテストが不安定になる
// PNG の構造の出典: https://www.w3.org/TR/png/#5DataRep
function makeLargePng(size = 800): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(zlib.crc32(typeAndData) >>> 0);
    return Buffer.concat([length, typeAndData, checksum]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 2; // カラータイプ 2 = RGB

  const stride = 1 + size * 3; // 行頭の1バイトはフィルタ種別（0 = None）
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = y * stride + 1 + x * 3;
      raw[offset] = (x * 255) / size;
      raw[offset + 1] = (y * 255) / size;
      raw[offset + 2] = 128;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.describe("画像の圧縮", () => {
  test("1MBを超える画像はアップロード前にwebpへ圧縮される", async ({ page, browser }) => {
    const uniqueTitle = `E2E圧縮テスト ${Date.now()}`;
    const largePng = makeLargePng();
    expect(largePng.byteLength).toBeGreaterThan(1024 * 1024); // 圧縮経路に入る前提の確認

    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.getByPlaceholder("例: 1", { exact: true }).fill("1");
    await page.getByPlaceholder("例: 42", { exact: true }).fill("42");
    await page.getByPlaceholder("例: p.42「わたし」→「私」の誤植", { exact: true }).fill(uniqueTitle);
    await page.getByPlaceholder("誤りのある文章をそのまま入力してください").fill("誤った文");
    await page.getByPlaceholder("正しいと思われる内容を入力してください").fill("正しい文");

    await page.locator('input[type="file"]').setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: largePng,
    });

    // 拡張子が webp に変わっている＝クライアント側の圧縮が走った証拠
    // （圧縮しなかった場合は元の名前のまま large.png になる）
    await expect(page.getByAltText("large.webp")).toBeVisible();

    await page.getByRole("button", { name: "投稿する" }).click();
    await page.waitForURL(/\/$/);

    // 保存された画像も webp（= 縮んだファイルがアップロードされている）
    const reportId = await openReportByTitle(page, uniqueTitle);
    await expect(page.getByAltText("証拠画像").first()).toHaveAttribute("src", /\.webp/);

    // 後片付け: 上のテストと同じく管理画面から削除する（ReportImage と Storage も掃除される）
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/admin/reports/${reportId}`);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "削除", exact: true }).click();
    await adminPage.waitForURL(/\/admin\/reports$/);
    await adminContext.close();
  });
});

test.describe("添付画像の拡大表示", () => {
  test("プレビューを押すと拡大表示が開く", async ({ page }) => {
    await login(page, READER);
    await mockBookApis(page);
    await page.goto("/submit");

    // 投稿はしないので書籍だけ選ぶ（拡大表示は選択直後から使えるべき機能）
    await page.getByPlaceholder("例: 9784873116860", { exact: true }).fill(BOOK_B.isbn);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText(BOOK_B.title)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "errata.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });

    // 拡大前は dialog が開いていない
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.getByRole("button", { name: "errata.png を拡大" }).click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByAltText("errata.png")).toBeVisible();

    // ESC で閉じられる（<dialog> のネイティブ挙動に頼っている部分なので担保しておく）
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});
