# 実装進捗メモ

## ステータス凡例
- [ ] 未着手
- [x] 完了
- [~] 作業中

---

## 🔄 引き継ぎ: 2026-06-22（別セッションで発生した作業の申し送り）
自己実現ログのセッションで流れ的に errata-hub を触ったため、開発セッション向けに残す。

### セキュリティ: シークレットを2件ローテート済み（要認識）
`.env` をスクショ共有した際にシークレットが写り込んだため、保険として両方ローテート。**値はここに書かない**（再流出防止）。
- **Supabase DBパスワード**: reset 済み。ローカル `.env` の `DATABASE_URL` / `DIRECT_URL` ＋ Vercel 環境変数を更新して再デプロイ。旧パスは無効。
- **Google Books API キー**: GCP でローテート＋「Books API のみ」に制限。ローカル `.env` の `GOOGLE_BOOKS_API_KEY` ＋ Vercel を更新・再デプロイ・**旧キー削除済み**。アプリ制限は「なし」が正解（サーバー側呼び出しは Referer が無くウェブサイト制限だと壊れる／IP制限も Vercel では不実用）。
- ⚠️ 別マシン/別環境に古い `.env` を持っている場合は、Vercel か手元の最新 `.env` から取り直すこと（古い値はもう動かない）。
- GitHub 履歴に本物の `.env` は無し（`.gitignore` 済み）を確認済み。`.env.example` はプレースホルダのみ。

### デザイン改善バックログ（ヘッドレス Playwright で本番を視認して抽出）
本番 `errata-hub.vercel.app` をデスクトップ/モバイル幅でスクショして確認。「v1.1 の最小1つ」は P1 から選ぶ想定。
- [ ] **P1: モバイルでテーブルが横溢れ**（390px 幅で右が切れ、ステータス/投稿者/投稿日が見えない・横スクロールに気づけない）→ カード型 or スクロール可を明示。実装重め＝v1.2 候補。
- [x] **P1: モバイルでナビ欠落** → 2026-06-23 解決。トップページの右側ナビを client component `src/components/header-nav.tsx` に切り出し、`sm` 未満ではハンバーガー（使い方/使用技術/会員登録/ログイン or ログアウト）に集約。主CTA「投稿する」は常時表示。Playwright で 390px/1280px 両幅を視認確認済み。※他ページのヘッダーは別途（重複あり）。
- [ ] **P3: ヘッダーのボタン階層**（ログイン(黒) と 投稿する(青) の塗りが競合）→ ログインを枠線控えめにして投稿するを主 CTA に。
- [ ] **P3: 空状態の親切化**（「該当する投稿がありません」→ アイコン＋投稿誘導）。
- [ ] **検証**: テスト投稿1件で表示確認（DBローテート後の本番接続の最終確認も兼ねる。現状は綺麗な空状態で接続成功の公算大）。

### メモ
- ヘッドレス Playwright でのデザイン確認が成立することを実証（`Google Chrome.app` ではなく同梱 Chromium をヘッドレス起動＝GUI ブロックと無関係）。一時スクリプト `_shot.mjs` は使用後に削除済み（リポジトリに残っていない）。
- 開発マシンに macOS スクリーンタイムの夜間ブロック（毎日 23:00-6:00・パスコード施錠）を導入した。**自分が起きて画面で行う作業は 23 時以降ブロックされる**。バックグラウンド/ヘッドレスのジョブは 23 時前に起動すれば継続する見込み（要実測）。

---

## 完了済み

- [x] Next.js プロジェクト作成（v16, TypeScript, Tailwind, App Router）
- [x] shadcn/ui 依存パッケージインストール（clsx, tailwind-merge 等）
- [x] TanStack Table インストール
- [x] src/lib/utils.ts 作成
- [x] src/lib/mock-data.ts 作成（モックデータ）
- [x] src/components/feedback-table.tsx 作成（TanStack Table）
- [x] src/app/page.tsx トップページ（モックデータで動作確認済み）

---

## 実装予定

### Phase 1: DB・バックエンド
- [x] Prisma スキーマ作成（schema.prisma）
- [x] .env に Supabase 接続先のテンプレートを記載
- [x] Supabase プロジェクト作成・接続情報を .env に記入
- [x] Prisma db push でテーブル作成（Session Pooler URL使用）
- [x] Prisma Client 生成（src/generated/prisma）
- [x] src/lib/prisma.ts 作成（PrismaPg adapter使用）
- [x] src/lib/supabase/client.ts 作成
- [x] src/lib/supabase/server.ts 作成
- [x] Supabase Storage バケット作成（feedback-images・5MB・image/*）

### Phase 2: データ取得（API → UI）
- [x] src/middleware.ts 作成（認証ミドルウェア）
- [x] feedbacks 一覧取得 API（GET /api/feedbacks）
- [x] トップページをモックデータ → DB データに切り替え（src/lib/mappers.ts 作成）

### Phase 3: 投稿フォーム
- [x] 書籍検索コンポーネント（Google Books API サジェスト）
  - タイトル検索・ISBN検索・手動入力の3モード
  - タイトル検索で見つからない場合はISBN検索を促すヒント表示
  - Google Books API キー設定済み（NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY）
- [x] フィードバック投稿フォーム（/submit）
  - バリデーションエラーは送信ボタン直上に表示
  - 複数ページにまたがる場合のヒントテキスト表示
- [x] 投稿 API（POST /api/feedbacks）
- [ ] 画像アップロード（Supabase Storage）※後回し可

### Phase 4: 認証
- [ ] Supabase Auth 設定
- [ ] ログイン・会員登録ページ
- [ ] 認証ミドルウェア（投稿フォームはログイン必須）

### Phase 5: 管理画面
- [x] 管理ダッシュボード（/admin → /admin/feedbacks へリダイレクト）
- [x] フィードバック一覧（/admin/feedbacks）
- [x] フィードバック詳細・回答入力・ステータス変更（/admin/feedbacks/[id]）
- [x] フィードバック削除（PATCH/DELETE /api/feedbacks/[id]）
- [x] 管理画面レイアウト（ヘッダーナビ）
- [ ] 出版社マスタ管理（/admin/publishers）
- [ ] 管理者ロール制御（Phase 4認証と連動）

### Phase 6: 書籍別・詳細ページ
- [ ] 書籍別投稿一覧（/books/[id]）
- [ ] フィードバック詳細（/feedbacks/[id]）← 書籍画像のGoogle帰属表示もここで

---

## 今回のセッションで対応した主な内容

- book-search.tsx: 手動入力モード追加（Google Books API 429対策）
- book-search.tsx: Google Books API キー設定（レート制限解消）
- book-search.tsx: ISBNで検索モード追加（タイトル検索で見つからない書籍に対応）
  - 例: 「Web API: The Good Parts」はGoogleにローマ字登録されておりタイトル検索不可
- feedback-form.tsx: バリデーションエラーを送信ボタン直上に移動
- feedback-form.tsx: 複数ページ時のヒントテキスト追加
- globals.css: ダークモード自動適用を無効化（color-scheme: light 追加）

---

## DB設計（確定）

### テーブル一覧
- publishers（出版社マスタ）
- books（書籍マスタ・タイトル単位）
- feedbacks（フィードバック本体）
- feedback_images（添付画像）
- users は Supabase Auth に委任

### 主な仕様
- 書籍は版単位ではなくタイトル単位で管理、版・刷は feedback 側で保持
- 位置情報：ページ番号（必須）＋行番号（任意）＋複数ページフラグ＋備考
- Kindle の場合は kindle_location（自由入力）
- 誤字脱字・正誤情報 → wrong / correct カラム
- 読みにくい・その他 → content カラム

---

## 技術スタック
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui + TanStack Table
- Supabase（PostgreSQL + Auth + Storage）
- Prisma ORM
- Zod（APIバリデーション）
- Google Books API（APIキー設定済み）
- OpenBD API（ISBN検索・日本語書籍データ取得）
- デプロイ: Vercel（未実施）

---

## 技術改善メモ（アピール強化・全て実施予定）

### バックエンドスキルアピール（優先度高）
- [x] **Zod バリデーション** — POST /api/feedbacks に実装済み
- [ ] **認証・認可** — Supabase Auth + ミドルウェア + ロール制御（Phase 4と連動）
- [ ] **Supabase RLS** — Row Level Security でDBレベルのアクセス制御
- [ ] **APIエラーハンドリング統一** — エラーレスポンス形式を統一、HTTPステータスコード整理
- [ ] **ページネーション** — GET /api/feedbacks にoffset/limit対応
- [ ] **DBスキーマ説明** — READMEにER図＋設計意図を記載

### コード品質
- [ ] **Server Actions** — フォーム投稿をAPI Route → Server Actionsに移行（App Routerらしい設計）
- [ ] **テスト** — Vitestでmappers.tsなどのロジック単体テスト追加

### インフラ・運用
- [ ] **GitHub + Vercel CI/CD** — プッシュ→自動デプロイのパイプライン
- [x] **ER図生成** — prisma-erd-generatorで自動生成（docs/erd.svg）

### UI/UX
- [ ] **ダークモード対応** — 現在はライトモード固定（color-scheme: light）
- [ ] **アクセシビリティ** — ARIAラベル・キーボードナビゲーション
- [ ] **タイトル検索→OpenBD自動補完** — ISBNがあれば自動でOpenBDデータに置き換え
- [ ] **ページネーション** — フィードバック一覧のoffset/limit対応
