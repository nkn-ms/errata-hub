# データモデル早見表

各テーブルの役割を1行で。詳細な型・制約は `prisma/schema.prisma`、図は `docs/erd.svg` を参照。

| テーブル | 役割（1行） |
|---|---|
| **Profile** | ユーザーのアプリ側プロフィール（表示名・ロール・メール記録）。id は Supabase `auth.users` の UUID と一致 |
| **Publisher** | 出版社マスタ。管理画面で CRUD。`emailDomain` はログイン時の自動権限付与に使用（ドメイン一致で PublisherAccess を自動付与・実装済み。ただし現状 access は表示のみで権限はゲートしない） |
| **PublisherAccess** | 「どのユーザーがどの出版社の中の人か」の多対多。出版社ユーザーかは Role でなくこのテーブルから導出 |
| **Book** | 書籍マスタ。**ISBN-13 が同一性の基準**（`@unique`）。投稿時に upsert で名寄せ |
| **Report** | 投稿の本体（正誤情報/改善提案/その他）。位置情報・誤/正・ステータス・出版社コメントを持つ |
| **Upvote** | 賛同（「自分も見つけた」）。`reportId × profileId` で一意＝1ユーザー1投稿1回 |
| **ReportImage** | 投稿の証拠画像。実体は Supabase Storage バケット `report-images`（公開読み取り・書き込みはサーバー経由のみ）、`imageUrl` に公開 URL を保存。投稿削除時に Storage のファイルも削除 |
| **AuditLog** | 操作ログ。誰が・いつ・何を・どう変えたか（before/after の JSON）。90日で pg_cron が削除（本番に手動登録済み・リポジトリ管理外。登録SQLは [dev-environment.md §9](./dev-environment.md) 参照） |

## なぜ「User」テーブルが無いのか

認証情報（メール・パスワード）は Supabase の `auth.users`（Supabase 管理・こちらのスキーマ外）が持つ。
アプリが自前で持ちたい属性（表示名・ロール）だけを **Profile** に置き、`Profile.id = auth.users.id` で 1:1 対応させている。

- 認証情報を二重管理しない（パスワードhashなどはSupabaseに任せる）
- `Profile.email` は意図的な非正規化: 退会で `auth.users` を物理削除した後も操作履歴を追跡するための記録用（退会時は `deleted-<id>@deleted.local` に匿名化）
- 退会 = `auth.users` 削除 + Profile の PII スクラブ。Report は「退会済みユーザー」表示で保全（Report.userId が Profile を参照し続けるため Profile 行は消さない）

## 参照整合の方針

- 削除の連鎖は DB の外部キー制約（onDelete）で担保: Report 削除→ReportImage/Upvote は Cascade、Book.publisherId は Restrict（本が残る限り出版社は消せない）
- 記事ゼロの Book/Publisher（孤児行）は放置で許容（再投稿時に再利用される）
