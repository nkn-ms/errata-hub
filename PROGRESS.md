# 実装進捗メモ

## ステータス凡例
- [ ] 未着手
- [x] 完了
- [~] 作業中

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
