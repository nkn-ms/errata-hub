# Errata Hub

[![CI](https://github.com/nkn-ms/errata-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/nkn-ms/errata-hub/actions/workflows/ci.yml)

**技術書を読んでいて見つけた誤りや「こう書いた方が読みやすい」という気づきを、読者が投稿して共有できる公開サイトです。**

投稿には誤りの箇所（ページ・行や版・刷）を添えられ、出版社が回答・対応状況を更新できます。

> ℹ️ 掲載されている投稿は投稿者からの報告であり、出版社の回答がつくまでは未確認の情報です。各投稿に表示される出版社の回答・対応状況とあわせてご確認ください。

---

## なぜ作ったか

技術書を読んでいると、公式の正誤表にも載っていない誤りに出くわすことがあります。そうした「誤りを見つけ、指摘した」という記録を、技術者自身のポートフォリオとして残せる場が欲しいというのが動機の一つです。
また、投稿しやすいフォームを用意することで、他の技術者の方も気軽に指摘でき、正誤情報がより多くの人に届く——そんな場になればと考えて作りました。

技術的にも、不特定多数が投稿する公開 UGC（ユーザー生成コンテンツ）を題材に、**認証・認可・データ整合性・セキュリティといった「実運用で効いてくる設計」を自分の手で一通り実装してみたかった**、という狙いもありました。

---

## 主な機能

- **書籍検索つき投稿フォーム** — ISBN 検索（OpenBD）/ タイトル検索（Google Books）。書影は両 API でフォールバック補完
- **投稿（種別つき）** — 正誤情報・改善提案・その他の 3 種別。ページ/行・版/刷などの位置情報つき
- **公開ページ** — トップ（最新投稿）・書籍別一覧・投稿詳細・ユーザー別投稿一覧
- **メール認証** — Supabase Auth（メール確認・PKCE code フロー）
- **管理画面** — 投稿への回答・対応状況の更新、出版社マスタ管理、ユーザー/ロール管理、操作ログ（監査ログ）

---

## 技術スタック

| 領域 | 採用技術 |
|------|----------|
| フレームワーク | Next.js 16（App Router）/ React 19 / TypeScript |
| スタイリング | Tailwind CSS v4 / 自作 UI コンポーネント（lucide-react アイコン） |
| 認証 | Supabase Auth（メール確認・PKCE code フロー） |
| データベース | PostgreSQL（Supabase ホスティング） |
| ORM | Prisma v7（`@prisma/adapter-pg`） |
| バリデーション | Zod |
| テーブル UI | TanStack Table |
| 外部 API | OpenBD（日本語書誌・ISBN）/ Google Books（タイトル検索・書影） |
| テスト | Vitest（単体）/ Testing Library |
| CI | GitHub Actions（lint + typecheck + test + build）/ Dependabot |
| デプロイ | Vercel（予定） |

---

## 設計上のポイント（技術的なこだわり）

- **データアクセスは Prisma 直叩き + サービス層に集約** — サーバーコンポーネントから `src/services/*` の関数を直接呼び、HTTP の往復を挟まない。外部公開が必要なときだけ API Route を置く。
- **認可はサーバー層に集約** — 各 API / Server Action の実行時に `services/auth.ts` の `requireAdmin` を必ず通すことを**唯一の信頼境界**とする（毎回 DB の最新ロールを確認）。レイアウトガードや `proxy.ts`（認証チェックのみ）は、管理 UI の表示制御・未ログインの早期リダイレクトといった補助的な役割で、セキュリティを保証するのは操作ごとの `requireAdmin`。
- **RLS は「公開裏口（PostgREST）のロック」として活用** — anon キーで触れる経路を全拒否で塞ぎ、データ操作は信頼できるサーバー経由（Prisma）に限定。
- **ISBN の正規化** — ISBN-10/13 を ISBN-13 に統一して名寄せ。`@unique` 制約で重複登録を防止。
- **API キーのサーバーサイド化** — Google Books API キーをクライアントに露出させず、認証必須のエンドポイント経由でのみ使用。
- **操作ログ（監査ログ）** — 削除等の操作前データを記録（物理削除 + AuditLog 方式）。

設計判断の詳細や学習メモは [`docs/learnings.md`](docs/learnings.md)、設計方針は [`docs/design.md`](docs/design.md) に記録しています。

### ER 図

データモデルの全体像は [`docs/erd.svg`](docs/erd.svg) を参照（Prisma スキーマから自動生成）。

---

## セットアップ

### 必要なもの

- Node.js 20 以上（CI は Node 22 で実行）
- Supabase プロジェクト（PostgreSQL + Auth）
- Google Books API キー

### 手順

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数の設定（.env を作成。下表参照）
cp .env.example .env   # 用意している場合

# 3. Prisma クライアント生成 & スキーマ反映
#    （--generator client で ER 図ジェネレータをスキップ）
npx prisma generate --generator client
npx prisma db push

# 4. 開発サーバー起動
npm run dev
```

http://localhost:3000 を開く。

### 開発コマンド

| コマンド | 内容 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | Prisma クライアント生成 + 本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | 単体テスト（Vitest・1回実行） |
| `npm run test:watch` | 単体テスト（ウォッチモード） |

型チェックは `npx tsc --noEmit` で実行できます。これら（lint / typecheck / test / build）は push・PR ごとに [GitHub Actions](.github/workflows/ci.yml) でも自動実行されます。

### 環境変数

| 変数名 | 用途 |
|--------|------|
| `DATABASE_URL` | アプリ用の DB 接続（コネクションプーラー経由） |
| `DIRECT_URL` | マイグレーション用の直接接続（Prisma v7 は `prisma.config.ts` で使用） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL（公開） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable キー（公開・RLS で保護） |
| `GOOGLE_BOOKS_API_KEY` | Google Books API キー（**サーバーサイドのみ**・公開しない） |

> `.env` は `.gitignore` 済み。`NEXT_PUBLIC_` 以外の値は秘密情報として扱い、コミットしないこと。

---

## ディレクトリ構成

```
src/
├── app/          Next.js ルーティング（ページ・API Route・Server Action）
├── components/   UI コンポーネント（admin/ に管理画面専用）
├── constants/    定数（ステータス定義など）
├── generated/    Prisma 自動生成（編集不可・gitignore）
├── lib/          外部ライブラリのラッパー（prisma / supabase / utils）
├── services/     ビジネスロジック・認可（auth, audit, report）
├── types/        型定義
└── utils/        純粋関数（ISBN 正規化・マッパー）
docs/             設計・学習メモ・ER 図
```

---

## ライセンス

本プロジェクトにはオープンソースライセンスを付与していません。
そのため、著作権法上の権利はすべて作者に帰属します（All rights reserved）。
コードはポートフォリオとしての公開であり、無断での複製・再配布・再利用はご遠慮ください。
