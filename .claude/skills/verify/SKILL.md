---
name: verify
description: errata-hub の変更をローカル実機で検証する手順（ビルド・起動・操作のレシピ）
---

# errata-hub の実機検証レシピ

## 前提・起動

1. Docker 起動 → `supabase start`（ローカル Supabase。データは Docker ボリュームに永続）
   - `supabase/config.toml` を変更したら `supabase stop && supabase start` で反映（stop はデータ保持）
   - GitHub OAuth のローカル用 client_id/secret は `.env.local` に置く。`supabase start` は `.env` と `.env.local` の両方を自動で読む（export 不要・両方実測確認済み）
2. `npm run dev`（localhost:3000、env は `.env.local`=ローカル Supabase）
   - 既に別の dev サーバーが 3000 を掴んでいると新規起動は exit 1（`kill <PID>` してから）
3. schema.prisma を変えたら `npx prisma db push`（ローカルに反映）＋ dev サーバー再起動（Prisma クライアント再読込のため）

## アカウント・データ

- シード垢: `admin@local.test` / `reader@local.test`（ともに password123）。無ければ `npm run seed:local`
- DB 直接確認: ホストに psql が無いので `docker exec supabase_db_errata-hub psql -U postgres -t -c "<SQL>"`
- メール確認: Mailpit http://127.0.0.1:54324 / Studio: http://127.0.0.1:54323

## 駆動

- Playwright MCP でブラウザ操作（ログイン → 対象フローを実操作 → スクリーンショット）
- e2e スイート: `npx playwright test`（ローカルでは書き込み系 write-local project も自動で有効・シード垢使用）
- サーバーアクションの着弾は dev ログの `POST /<path> → ƒ アクション名()` 行で確認できる

## 罠

- dev 直後のクリックは HMR 再ビルド直後だと hydration 前で form action が発火しないことがある → リロードして再操作
- ログイン/登録ページはカード div の中に form が複数（メイン+GitHub ボタン）。form ネストは hydration エラーになるので構造変更時は注意
- 本番/Preview に向けた検証はしない（検証は原則ローカル、Preview は最終スモークのみ）
