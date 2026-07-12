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
  コードのデプロイでは DB は変わらない（§7 の反映手順で行う）。
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
| 本番にスキーマを反映したい（稀） | §7 の手順で。**正は `prisma db push`**・SQL 直打ちは代替 |

## 7. 本番DBへのスキーマ反映手順（正: `prisma db push`）

`schema.prisma` の model/enum を変更した機能を本番反映するとき、**コードの main マージでは DB スキーマは変わらない（別作業）**。マージ前に本番 DB へ反映しておく（先にコードだけ本番に出ると、新カラムを参照した瞬間に落ちるため）。

### 方法A（正）: `prisma db push`

```bash
# 別ターミナルで、対象ブランチを checkout した状態で（この会話・ファイルに URL を残さない）
DIRECT_URL="<本番の direct 接続文字列>" npx prisma db push
```

- inline の env が `.env.local` より優先される（dotenv は既存 env を上書きしない。prisma.config.ts 参照）
- 接続文字列は Supabase ダッシュボード → Connect → **Direct connection**（port 5432）。DB パスワードが要る
  - パスワードはプロジェクト作成時にしか表示されないので**パスワードマネージャに控えておく**
  - 紛失したら Settings → Database → Reset database password で再発行できるが、**Vercel の DATABASE_URL / DIRECT_URL も貼り替えが必要になる**（Sensitive のため上書き再設定）
- 「data loss」系の警告が出たら中断して内容を確認（カラム削除・型変更など破壊的変更のとき）

**なぜこれが正か**: `schema.prisma` が git 管理された唯一の正で、db push はそこから DDL を機械的に導出する（手書きミスが構造的に起きない・実DBとの差分計算と破壊的変更の警告つき）。将来の Prisma Migrate 移行（SQL をファイルとして git 管理）も「schema と実DBの一致」が前提で、db push 運用はそれを保証する。手動 SQL を常用すると一致が人間の注意力頼みになりドリフトの温床になる。

### 方法B（代替）: SQL Editor で DDL 直打ち

接続文字列がすぐ取れないとき（例: パスワード不明で Reset は避けたい）は、Supabase ダッシュボード → SQL Editor で DDL を直接実行してもよい。ただし:

- **db push が発行する SQL と同一内容にする**こと。手書きせず、ローカルで次のコマンドで生成するのが安全:
  ```bash
  # ローカルDB（schema変更前の状態）と schema.prisma の差分 DDL を「表示するだけ」（実行はしない）
  # from = prisma.config.ts の接続先（.env.local 優先＝ローカルDB）、to = schema.prisma
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
  ```
  ※ Prisma v7 で `--from-url` は削除され `--from-config-datasource` になった（`--script` を外すと人間向け要約）。差分が無いと `-- This is an empty migration.` と出る＝ローカルDBと schema が一致している確認にも使える
- テーブル名・カラム名のダブルクォートは必須（Prisma は大文字小文字混在の名前で作るため、外すと別名扱いでエラー）
- 実績: 2026-07-09 に `Profile.githubUsername` / `xUsername` の追加をこの方法で反映した

## 8. なぜこの形にしたか（狙い）

1. **本番の秘密をローカルに置かない** ＝ 漏洩したときの被害範囲(blast radius)を最小化。
2. **手元の操作が本番DBを壊さない** ＝ `npm run dev` も `prisma db push` もローカルDBに向く。
3. 本番・Preview の値は **Vercel に一元化**。

## 9. リポジトリ管理外の本番DB設定（新環境では再登録が必要）

コードや schema.prisma に現れない、本番 Supabase に**直接 SQL で登録した**設定。DBを作り直す・環境を増やす際はここを見て再登録する。

### Storage バケット `report-images`（投稿の添付画像）

ローカルは `supabase/config.toml` の `[storage.buckets.report-images]` に定義し、**`supabase seed buckets` で作成する**（⚠️ `supabase start` だけでは作られない — CLI v2.108 で実測。既存環境・`db reset` 後は明示実行が必要）。**本番はダッシュボードで手動作成**（コードのデプロイでは作られない）。

- Supabase ダッシュボード → Storage → New bucket
  - 名前: `report-images` / **Public bucket: ON**（公開投稿の画像のため）
  - Restrict file size: **5MB** / Restrict MIME types: `image/png, image/jpeg, image/webp`（末尾に `/` を付けない）
  - サイズを 5MB にする理由: アプリ側の上限は 4MiB（`src/constants/report-images.ts`）で、ダッシュボードの「MB」が 10進解釈でも**常にアプリ側が先に効く**余裕を持たせるため（バケット側は保険の粗い網）
  - 2026-07-12 本番作成済み。※初期に作った未使用の `feedback-images` バケットは削除してよい（旧 feedback 時代の遺物・一度も未使用）
- Storage のポリシーは追加しない（書き込みはサーバーの secret キー経由のみ＝RLSロック方針と同じ）
- ⚠️ **画像投稿機能を含む PR を main にマージする前に本番バケットを作成しておく**（無いとアップロードが 500 になる。投稿自体は成功する設計）

### AuditLog の90日自動削除（pg_cron）

プライバシーポリシー第6条2項「90日を目安に削除」に対応するジョブ。**2026-07-03 に本番へ登録済み**（SQL Editor で実行・ローカルでも同SQL検証済み）。

```sql
select cron.schedule(
  'delete-old-audit-logs',           -- ジョブ名
  '0 0 * * *',                       -- 毎日 0:00 UTC（JST 9:00）
  $$ DELETE FROM "AuditLog" WHERE "createdAt" < now() - interval '90 days' $$
);
```

- 前提: Supabase ダッシュボード → Database → Extensions で `pg_cron` を有効化
- 実行履歴の確認: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
- 登録済みジョブの確認: `SELECT * FROM cron.job;`

## 10. Node のバージョン（24 = Active LTS）

**`.nvmrc`（= `24`）が単一の正**。ここを直せば全部が追従する:

| どこ | どう追従するか |
|---|---|
| ローカル | `nvm use`（リポジトリ直下で実行すると `.nvmrc` を読む） |
| CI | `actions/setup-node` の `node-version-file: .nvmrc` |
| Vercel | `package.json` の `engines.node: "24.x"`（プロジェクト設定のドロップダウンより優先される） |

> `.nvmrc` と `engines` の二重管理に見えるが、Vercel は `.nvmrc` を読まないため `engines` が必要。
> 出典: [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

### ⚠️ Node 24 は npm 11 を同梱 →  依存パッケージの install スクリプトが既定でブロックされる

`npm install` 時に `npm warn allow-scripts ... packages have install scripts not yet covered by allowScripts` が出る。
lint / typecheck / test / build / e2e はこれで壊れない（prebuilt バイナリを使う依存ばかりのため）が、
**postinstall でバイナリを取ってくる依存だけは注意**:

- `puppeteer`（ERD 生成 = `npx prisma generate` の erd generator が使う）は Chrome を postinstall で
  `~/.cache/puppeteer` に落とす。新しいマシンで ERD を再生成するときに無ければ
  `npx puppeteer browsers install chrome` で取得する（または `npm approve-scripts` で許可）。
