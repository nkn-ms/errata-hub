import { test, expect } from "@playwright/test";
import { SEED_ADMIN as ADMIN, SEED_READER as READER } from "./seed-accounts";
import { login } from "./login";
import { createThrowawayAccount } from "./throwaway-user";
import { backgroundContrast } from "./contrast";
import { createThrowawayReport, deleteReportAsAdmin } from "./throwaway-report";

// 管理画面（書き込み）の e2e。ローカル dev＋ローカル Supabase 限定で実行される
// （playwright.config.ts の write-local project）。前提は他の書き込みテストと同じ:
// `supabase start` ＋ `npm run seed:local` 済みであること。
//
// 担保するのは管理画面の更新フロー（Server Actions）。
// いずれのテストも、最後にシードの初期状態へ戻してから終わる（繰り返し実行できる）。

const SEED_PUBLISHER = "オーム社"; // シードが作る唯一の出版社

test.describe("認可（管理画面）", () => {
  test("一般ユーザーがログイン済みでも /admin には入れずトップに戻される", async ({ page }) => {
    await login(page, READER);

    await page.goto("/admin");

    // requireAdminPage（services/auth.ts）が ADMIN 以外を "/" に redirect する
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "投稿一覧" })).toBeHidden();
  });
});

test.describe("現在地の表示（管理画面のナビ）", () => {
  test("見ている画面の項目が現在地になり、詳細に入っても一覧のまま", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/books");
    const booksNav = page.getByRole("link", { name: "書籍マスタ" });
    await expect(booksNav).toHaveAttribute("aria-current", "page");
    // 他の項目は現在地にならない（＝どこに居るか1つに定まる）
    await expect(page.getByRole("link", { name: "ユーザー管理" })).not.toHaveAttribute(
      "aria-current",
      "page"
    );

    // 詳細ページは一覧の下位なので、入っても一覧の項目が点いたまま（前方一致）
    await page.getByRole("row").filter({ hasText: "Web API" }).getByRole("link", { name: "編集" }).click();
    await page.waitForURL(/\/admin\/books\/[0-9a-f-]+$/);
    await expect(page.getByRole("link", { name: "書籍マスタ" })).toHaveAttribute("aria-current", "page");
  });

  // 属性が正しくても、面が帯と見分けられなければ「選択されている」ことは伝わらない
  // （当初 bg-gray-800＝帯より一段明るいだけで、実機では読み取れなかった）。
  // 実測（ローカル dev・2026-07-30）: 現行の反転ピル light 14.33:1 / dark 14.27:1、
  // 旧 bg-gray-800 は light 1.21:1 / dark 1.26:1 でこのテストが落ちる。
  test("現在地の面は帯とはっきり分かれている", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/books");

    const ratio = await backgroundContrast(page, 'header nav [aria-current="page"]', "header");
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

test.describe("投稿のステータス更新（管理者）", () => {
  test("ステータスと出版社コメントを更新すると、公開ページに反映される", async ({ page }) => {
    const title = `E2E管理更新テスト ${Date.now()}`;
    const comment = `E2E 出版社コメント ${Date.now()}`;
    await login(page, ADMIN);

    // 使い捨ての投稿を自分で作る（シードの投稿は借りない = e2e/throwaway-report.ts）
    const reportId = await createThrowawayReport(page, title);

    await page.goto(`/admin/reports/${reportId}`);
    await page.getByRole("button", { name: "修正済み", exact: true }).click();
    await page.getByPlaceholder("出版社からの回答や対応内容を記載してください").fill(comment);
    await page.getByRole("button", { name: "更新する" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();

    // 公開側の投稿詳細に反映されている（更新系が Server Action 経由でも読み取りに載ること）
    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("修正済み")).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();

    // 戻せることも見る（一本道のステータスを画面から巻き戻す操作は、実運用でも打ち間違いの訂正で使う）
    await page.goto(`/admin/reports/${reportId}`);
    await page.getByRole("button", { name: "未対応", exact: true }).click();
    await page.getByPlaceholder("出版社からの回答や対応内容を記載してください").fill("");
    await page.getByRole("button", { name: "更新する" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();

    await page.goto(`/reports/${reportId}`);
    await expect(page.getByText("未対応")).toBeVisible();
    await expect(page.getByText(comment)).toBeHidden();

    await deleteReportAsAdmin(page, reportId);
  });
});

test.describe("出版社アクセスの付与・剥奪（管理者）", () => {
  test("一般ユーザーに出版社を付与でき、剥奪すると一覧から消える", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/users");
    await page
      .getByRole("row")
      .filter({ hasText: READER.email })
      .getByRole("link", { name: "編集" })
      .click();
    await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);
    const userEditUrl = page.url();

    await expect(page.getByText("付与された出版社なし")).toBeVisible();

    // 選んで「追加」を押しただけでは送らない（「追加予定」として並ぶだけ）。
    // 押した瞬間に反映していた頃は、押し間違いを戻す手立ても、何が変わったかを知る手立ても無かった
    await page.getByRole("combobox").selectOption({ label: SEED_PUBLISHER });
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("追加予定")).toBeVisible();
    await expect(page.getByText("更新しました")).toHaveCount(0);

    await page.getByRole("button", { name: "アクセス権を更新する" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();
    await expect(page.getByText("追加予定")).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: SEED_PUBLISHER })).toBeVisible();

    // 出版社側の画面からも「誰が持っているか」と「誰が付けたか」が分かる。
    // 以前は件数しか出ておらず、誰かを知るにはユーザー一覧を辿る必要があった＝
    // 「なぜこの人が権限を持つのか」を後から説明できなかった。
    await page.goto("/admin/publishers");
    await page
      .getByRole("row")
      .filter({ hasText: SEED_PUBLISHER })
      .getByRole("link", { name: "編集" })
      .click();
    await page.waitForURL(/\/admin\/publishers\/[0-9a-f-]+$/);

    const accessRow = page.getByRole("row").filter({ hasText: READER.email });
    await expect(accessRow).toBeVisible();
    // 付与者＝いま操作した管理者。付与の出所が行に残っていることを見る
    await expect(accessRow).toContainText(ADMIN.email);

    // 操作ログの「変更後」は既定で1行に切ってあり、開くと全文が読める（表の形を保つため。
    // 「投稿削除」の変更前には投稿1件が丸ごと入るので、常に全文だと一覧が成立しない）。
    // ⚠️ 開いて読めるのは**記録に入っている値だけ**。出版社名は残しているので出るが、
    //    付与した相手は targetId の UUID しか無く、この行からは誰に付けたのか読めないままである
    await page.goto("/admin/logs?action=GRANT_PUBLISHER_ACCESS");
    const logRow = page.getByRole("row").filter({ hasText: "出版社アクセス付与" }).first();

    const changedTo = logRow.locator("details").last();
    await expect(changedTo.locator("pre")).toBeHidden();
    await changedTo.locator("summary").click();
    await expect(changedTo.locator("pre")).toBeVisible();
    await expect(changedTo.locator("pre")).toContainText(SEED_PUBLISHER);

    // 対象は「誰に付与したか」がそのまま読める（型名 PublisherAccess と UUID を出していた頃は、
    // あの UUID を PublisherAccess の ID だと読まれた。実際は Profile の id）
    const target = logRow.locator("details").first();
    await expect(target).toContainText(`ユーザー:${READER.email}`);

    // 開くと保存されている型名と ID もそのまま読める（記録の正はこちら）
    await target.locator("summary").click();
    await expect(target.locator("pre")).toHaveText(
      new RegExp(`^ユーザー:${READER.email}\\nPublisherAccess:[0-9a-f-]{36}$`)
    );

    // 剥奪（＝シードの初期状態に戻す）。こちらも押しただけでは消えず、印を付けて確定する。
    // ⚠️ 印を付けた行を一覧から外さない（消えたのか壊れたのか区別が付かなくなる）
    await page.goto(userEditUrl);
    await page.getByRole("button", { name: "権限を外す" }).click();
    await expect(page.getByText("削除予定")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: SEED_PUBLISHER })).toBeVisible();

    // 気が変わったら戻せる（確定していないのだから戻せるべき）
    await page.getByRole("button", { name: "外すのをやめる" }).click();
    await expect(page.getByText("削除予定")).toHaveCount(0);

    await page.getByRole("button", { name: "権限を外す" }).click();
    await page.getByRole("button", { name: "アクセス権を更新する" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();
    await expect(page.getByText("付与された出版社なし")).toBeVisible();

    // 一覧側にも反映されている（付与列が "-" に戻る）
    await page.goto("/admin/users");
    const readerRow = page.getByRole("row").filter({ hasText: READER.email });
    await expect(readerRow).not.toContainText(SEED_PUBLISHER);
  });
});

test.describe("管理者による代行退会", () => {
  // ⚠️ 取り消せない操作なので、対象は必ず使い捨てアカウント（シード垢・管理者垢は絶対に使わない）。
  test("表示名を確認入力すると退会させられ、ログインできなくなる", async ({ page }) => {
    const account = await createThrowawayAccount();

    await login(page, ADMIN);
    await page.goto(`/admin/users/${account.id}`);

    // 確認入力が空／一致しないうちは押せない（押し間違いの砦）
    const withdrawButton = page.getByRole("button", { name: "退会させる" });
    await expect(withdrawButton).toBeDisabled();
    const confirmation = page.getByLabel(/入力してください/);
    await confirmation.fill(account.displayName.slice(0, -1));
    await expect(withdrawButton).toBeDisabled();

    await confirmation.fill(account.displayName);
    await expect(withdrawButton).toBeEnabled();
    await withdrawButton.click();

    // 成功すると一覧へ戻る
    await page.waitForURL(/\/admin\/users$/);

    // 対象は匿名メールになっている（＝ Profile はスクラブ済みで残る）。
    // 一覧は登録日の昇順＋1ページ50件なので、いま作った使い捨てアカウントは最後のページに居る
    // （範囲外の ?page=N は最後のページへ寄せられるので、件数を知らなくても辿り着ける）。
    await page.goto("/admin/users?page=999");
    await expect(page.getByRole("row").filter({ hasText: account.email })).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: `deleted-${account.id}@deleted.local` })
    ).toBeVisible();

    // 操作ログに残る（誰が代行したかを後から追える）
    await page.goto("/admin/logs");
    await expect(page.getByRole("row").filter({ hasText: "退会（管理者代行）" }).first()).toBeVisible();

    // auth.users が消えているので、本人はもうログインできない
    await page.goto("/login");
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません")).toBeVisible();
  });

  test("管理者自身と他の管理者は退会させられない（理由が出て入力欄も出ない）", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/users");
    await page
      .getByRole("row")
      .filter({ hasText: ADMIN.email })
      .getByRole("link", { name: "編集" })
      .click();
    await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);

    await expect(page.getByText("自分自身を退会させることはできません。")).toBeVisible();
    await expect(page.getByRole("button", { name: "退会させる" })).toHaveCount(0);
    await expect(page.getByLabel(/入力してください/)).toHaveCount(0);
  });
});

test.describe("一覧のページ送り（管理画面）", () => {
  // 一覧5本すべてが同じ ?page=N の作法で動くことを担保する。件数を50件超に膨らませずに
  // 検証できるのは「範囲外のページ番号を寄せる」側で、シードが少ないほど確実に範囲外になる。
  //
  // /admin/logs だけ入っていないのは、シード直後の操作ログが0件だから。0件のときは寄せる先が
  // 無いので仕様上そのまま「ログがありません」を出す（utils/pagination.ts）＝この観点では測れない。
  // 寄せる処理自体は他4本と同じ paginate + redirect を通っている。
  const LIST_PAGES = [
    { path: "/admin/reports", heading: "投稿一覧" },
    { path: "/admin/publishers", heading: "出版社マスタ" },
    { path: "/admin/books", heading: "書籍マスタ" },
    { path: "/admin/users", heading: "ユーザー管理" },
  ];

  for (const { path, heading } of LIST_PAGES) {
    test(`${path} は範囲外の ?page=N を最後のページへ寄せる`, async ({ page }) => {
      await login(page, ADMIN);

      // 寄せずに素通ししていた頃は、行があるのに空スライスを引いて「ありません」を出していた
      await page.goto(`${path}?page=999`);

      // 寄せ先は「最後の有効ページ」なので、番号は決め打ちできない（ローカルの件数で変わる）。
      // 999 のままでないこと＋そこから先が無いこと（「次へ」が出ない）で最後のページだと言える
      await expect(page).toHaveURL(new RegExp(`\\?page=(?!999$)\\d+$`));
      await expect(page.getByRole("link", { name: "次へ" })).toHaveCount(0);

      // 見出しと行が出る＝空スライスを引いていない（これが寄せる目的）
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      expect(await page.getByRole("row").count()).toBeGreaterThan(1); // 1行目は表の見出し
    });
  }

  // 1画面に収まっている一覧に「1 / 1」は情報を足さないので出さない（シードは50件未満）
  test("1ページに収まる一覧ではページ送りを出さない", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/reports");

    await expect(page.getByRole("navigation", { name: "ページ送り" })).toHaveCount(0);
  });
});
