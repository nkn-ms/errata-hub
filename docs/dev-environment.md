# 開発環境と env の地図

このアプリの「環境変数(env)がどこに置かれ、どの環境がどれを読むか」をまとめた地図。
env で迷ったらここを見る。

> **環境変数(env)** = アプリの設定値や秘密情報（DB の接続先・API キー等）を**コードの外**に出して、
> 環境ごとに差し替えられるようにする仕組み。コードは `process.env.XXX` で読む。

## 0. ⚠️ 忘れてはいけないこと（先に読む）

- **ローカルの値は全部 `.env.local`**。`.env` は方針コメントのみの空ファイル（§4）。
- **Supabase CLI（`supabase start`）も `.env` と `.env.local` を自動で読む**（実測確認済み）。
  GitHub ログインのローカル用 client_id/secret はここから `supabase/config.toml` の `env()` に入る。
- **`supabase/config.toml` や Supabase 向け env 値を変えたら `supabase stop && supabase start`**。
  起動中のコンテナには反映されない（データは stop では消えない。消えるのは `db reset` 時）。
- **`prisma/schema.prisma` を変えた PR は、main マージとは別に本番 Supabase への `prisma db push` が必要**。
  コードのデプロイでは DB は変わらない（§6 break-glass 手順）。
- **本番反映は feature ブランチ → Vercel Preview で実機確認 → PR マージ**。CI が緑でも直マージしない。
- **e2e を本番/Preview に向けるときだけ `.env.e2e`** を使う（普段のローカル e2e はシード垢を自動使用）。
  この分離は「うっかり本番に書き込む e2e」を防ぐ安全弁なので、`.env.local` に統合しない。
- **public 化（検索に出す）時に noindex を外す**（`robots.ts` と `layout.tsx` の2箇所）。それまでは維持。

## 1. 「環境」は3つ

| 環境 | どこ | 何のため |
|---|---|---|
| **ローカル開発** | 自分のマシン | 手元で作って試す |
| **Preview** | Vercel（feature ブランチごと） | 公開前の確認 |
| **本番** | Vercel（`main` から） | 実際に公開 |

## 2. 値の置き場所（どの環境がどこから読むか）

| 環境 | 値の置き場所 | 中身（接続先） |
|---|---|---|
| ローカル | **`.env.local`**（マシン上・gitignore） | **ローカル** Supabase（127.0.0.1） |
| Preview | **Vercel 環境変数** | 本番 Supabase |
| 本番 | **Vercel 環境変数** | 本番 Supabase |

→ **本番の値は Vercel だけ**にある。ローカルには本番の値を置かない（漏洩面を減らす方針）。

## 3. 優先順位（なぜローカルが勝つか）

- **アプリ実行（`npm run dev`）**: Next.js が `.env.local` を `.env` より**優先**して読む。
  - これは Next.js の公式仕様（探索順: `process.env` → `.env.$(NODE_ENV).local` → `.env.local` → `.env.$(NODE_ENV)` → `.env`。最初に見つかった値で確定。
    出典: [Next.js Guides > Environment Variables > Load Order](https://nextjs.org/docs/app/guides/environment-variables)、手元では `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` で確認可）。
    「共通のデフォルトは `.env`、そのマシン固有の上書きは `.env.local`」という **dotenv 界隈の標準的な重ね着方式**で、Vite や CRA も同じ流儀。
    `.env.development` / `.env.production` は NODE_ENV でファイルが自動選択される仕組み（このプロジェクトでは未使用）。
  - Vercel 上には `.env`/`.env.local` ファイルが**存在しない**ので、Vercel が値を直接 `process.env` に注入する＝Vercel の環境変数が使われる。
- **Prisma の CLI**（`prisma db push` 等）: 素では `.env` しか読まない。そこで `prisma.config.ts` を
  「**`.env.local` → `.env` の順で読む**」よう設定している（dotenv は既存値を上書きしないので `.env.local` が勝つ）。
  これで CLI もローカルを向く＝**手元の操作が誤って本番DBを叩かない**。
- **Supabase CLI（`supabase start`）**: `.env` と `.env.local` の両方を自動で読み、
  `supabase/config.toml` 内の `env(変数名)` に差し込む（2026-07 実測確認）。ローカル用 GitHub OAuth の値はこの経路で渡る。

```
[自分のマシン]  npm run dev / prisma ──読む──▶ .env.local（ローカル Supabase）
[Vercel 本番]   ビルド・実行          ──読む──▶ Vercel 環境変数（本番 Supabase）
```

## 4. 各ファイルの中身

| ファイル | git | 中身 |
|---|---|---|
| `.env.local` | 対象外 | **ローカル開発の実値**（ローカル Supabase ＋ Google キー ＋ ローカル用 GitHub OAuth）← 普段使うのはこれ |
| `.env` | 対象外 | **コメントのみ**（本番値はゼロにスクラブ済み） |
| `.env.example` | 追跡 | 必要な変数の一覧＋ホスト型 Supabase の例（値なしテンプレ） |
| `.env.local.example` | 追跡 | ローカル開発用テンプレ（値なし） |
| `.env.e2e` | 対象外 | Playwright e2e 用のテストアカウント |
| `.env.e2e.example` | 追跡 | そのテンプレ |
| （Vercel 環境変数） | — | 本番・Preview の実値 |

> `*.example` は**値の入っていない見本**で、git で共有するためのもの。実値入りファイル（`.env*`）は全部 gitignore。

## 5. ローカル環境の起動

```bash
# Docker Desktop を起動しておく
supabase start                 # ローカル Supabase（Auth+DB+Studio+メール）一式
cp .env.local.example .env.local
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を `supabase status` の値に置き換える
npx prisma db push             # ローカルDBにスキーマ反映（.env.local を見る）
npx prisma db seed             # 管理者ユーザー＋サンプルデータを投入（冪等。`npm run seed:local` でも可）
npm run dev                    # http://localhost:3000
```

- **管理者ログイン**: `admin@local.test` / `password123`（シードが作る・ローカル専用）
- ローカル Studio（DB の中身を見る）: http://127.0.0.1:54323
- 受信メール（確認メール等）: http://127.0.0.1:54324

シード（`prisma/seed.ts`・Prisma 公式の `prisma db seed` 方式）は冪等で、`supabase status` から接続情報を取り、
接続先がローカル(127.0.0.1)でなければ中止する安全装置付き。`supabase db reset` 後もこれ一発で復元できる。

## 6. チートシート: 「この操作、どのDBに効く？」

| 操作 | 効く先 |
|---|---|
| ローカルで `npm run dev` | **ローカル** Supabase |
| ローカルで `prisma db push` | **ローカル** Supabase（`.env.local` 優先のため） |
| `git push` → main → Vercel 本番デプロイ | **本番** Supabase |
| 本番にスキーマを反映したい（稀） | **break-glass**: Supabase ダッシュボードから接続情報を取り、その場限りで実行（ローカルに残さない） |

## 7. なぜこの形にしたか（狙い）

1. **本番の秘密をローカルに置かない** ＝ 漏洩したときの被害範囲(blast radius)を最小化。
2. **手元の操作が本番DBを壊さない** ＝ `npm run dev` も `prisma db push` もローカルDBに向く。
3. 本番・Preview の値は **Vercel に一元化**。
