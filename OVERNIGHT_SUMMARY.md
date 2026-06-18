# 夜間作業サマリ（2026-06-17）— 情報ページの追加

ブランチ `feature/info-pages` で作業。main は無変更・未 push。`npm run build` 成功。

## やったこと

1. **ブランチ `feature/info-pages` 作成**（main から分岐）。
2. **使い方ページ `/how-to-use` を追加**（`src/app/how-to-use/page.tsx`）
   - 投稿の流れ（書籍検索 → 種別選択 → 内容入力 → 投稿）を4ステップで説明。
   - 種別の使い分け（正誤情報 / 改善提案 / その他）を説明。
   - 各ステータスの意味を `src/constants/report-status.ts` の `STATUS_LABELS` /
     `STATUS_COLORS` / `STATUS_TOOLTIPS` を参照して列挙（定義のハードコード重複を避けた）。
   - トップの免責バナーと同じ文言を末尾に再掲。
3. **技術紹介ページ `/tech` を追加**（`src/app/tech/page.tsx`）
   - 使用技術と「なぜ選んだか」: Next.js 16 App Router / TypeScript / Tailwind /
     Supabase Auth(PKCE, RFC 7636) / Prisma v7 / Google Books API。
   - システム構成（ブラウザ → Vercel → Supabase / Google Books）を簡単な縦並びの図で表現。
   - ポートフォリオ/面談アピール用のトーン。
4. **ナビリンク追加**: トップページ（`src/app/page.tsx`）ヘッダーに「使い方」「使用技術」リンクを追加
   （`sm` 以上で表示）。`/how-to-use` ヘッダーには「投稿する」、`/tech` ヘッダーには「使い方」リンク。
5. **ルート集約**: `src/constants/routes.ts` に `howToUse` / `tech` を追加（既存規約の「縫い目」に従う）。

## コミット一覧

- `178756d` 使い方ページ /how-to-use を追加（routes.ts + page.tsx ナビ含む）
- `577aa3d` 技術紹介ページ /tech を追加

## 判断・既定の選択

- **両ページとも静的（Server Component）**: データ取得や認証が不要なため `export const metadata`
  付きの純粋な表示ページにした。build で `○ (Static)` としてプリレンダされることを確認。
- **noindex には未介入**: layout.tsx の `robots: { index: false }` を継承するため、新ページも
  非インデックス。公開時に既存 TODO（[[todo-remove-noindex-on-launch]]）で一括解除される想定。
- **ステータスは定数から動的列挙**: ラベル/説明をページに直書きせず report-status.ts を参照。
  種別の説明文のみページ内に定義（説明文の出所が他に無いため）。
- **構成図はテキストベース**: 画像/SVG を増やさず、Tailwind の div で縦並び＋矢印にした
  （依存追加なし・保守容易）。
- **共通ヘッダーコンポーネントは作らなかった**: 既存ページもヘッダーをインライン重複させており、
  「無関係なコードをリファクタしない」ガードレールに従い既存スタイルに倣うだけにした。

## 要レビュー観点

- 文言・トーン（特に /tech の選定理由）が意図に合うか。種別の説明（特に「その他」）の粒度。
- ヘッダーのナビ位置・モバイル表示（使い方/使用技術は `hidden sm:block`）。レイアウトの好み。
- `/how-to-use` `/tech` ともヘッダーのリンク先が最小限（相互回遊が弱い）。フッターや相互リンクを
  足すか検討の余地あり。
- 構成図のスタイル（テキスト図でよいか、将来 SVG 化するか）。

## 残課題 / 未対応（スコープ外として手を付けず）

- 共通ヘッダー/フッターコンポーネント化（重複の整理）は未実施。
- `/tech` の ER図・システム構成図の SVG 化（`docs/erd.svg` 等の掲載）は未実施。
- push はしていない（ローカルブランチのみ）。
