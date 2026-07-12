# 設計方針

目的: **一般公開される誤字・正誤情報プラットフォーム × ポートフォリオ**。

前提認識: これは「投稿フォーム付き CRUD」ではなく、**信頼性が命の UGC コンテンツ・プラットフォーム**。
誰でも任意の本に「ここが誤り」と書ける = 信頼性・モデレーション・発見性（SEO）が製品の本体。

※ §1〜6 の「実装状況」注記は 2026-07-10 時点。マークは ✅=実装済 / 🔶=一部実装 / ❌=未実装。確定済みの運用方針は §7 に集約。

---

## 1. ドメインモデル

```
Book               本（同一性 = 正規化 ISBN-13）
Publisher          出版社
Profile            ユーザー（Supabase auth と 1:1）
Report             誤り報告（旧 Feedback）★UGC の核
Confirmation       「自分も確認した」(Report への賛同) ★新規
PublisherResponse  出版社の公式回答（旧 publisherComment 文字列を第一級化）★新規
Flag               通報（不適切・誹謗中傷）★新規
PublisherMembership Profile×Publisher（旧 PublisherAccess）+ verified フラグ
AuditLog           管理操作ログ
```

主な変更:
- **Feedback → Report** に改名（実体は「正誤報告」）。 — ✅実装済（旧 `/feedbacks` は `/reports` へ）
- **出版社コメントを文字列カラム → `PublisherResponse` エンティティへ昇格**（誰が・いつ・どの肩書きで・複数回答・編集履歴）。 — ❌未実装（`Report.publisherComment` 文字列のまま）
- **Confirmation（賛同）追加** — 重複報告を「別レコード乱立」でなく「賛同が集まる」形に誘導。公開 DB の信頼性とノイズ除去の生命線。 — ✅実装済（実装名は **`Upvote`**・UI は「自分も見つけた」）

実装状況: 上記のほか `Flag`（通報）は❌未実装、`PublisherMembership` は旧 `PublisherAccess` のまま（改名・`verified` フラグとも❌未実装）。

---

## 2. 認可モデル（identity と capability の分離）

| 概念 | 持ち方 | source of truth |
|---|---|---|
| サイト管理者か | `Profile.role = ADMIN \| USER` | 保存 |
| 出版社担当か／どの出版社か | `PublisherMembership`（per-publisher） | 保存 |
| 「出版社ユーザー」表示 | membership があるかで導出 | 派生 |

- 3者モデル（管理者・一般・出版社）は `getUserKind()` で読み手に見せる。スキーマには重複を持たない → role と access の同期ズレが構造的に消える。
- 出版社化は「メールドメイン一致で**申請候補** → 管理者承認 or ドメイン所有検証」。ドメイン一致だけで公式回答権を与えない（なりすまし対策）。`PublisherMembership.verified`。

実装状況: `Profile.role = ADMIN | USER` への縮小（PUBLISHER ロール廃止・出版社かは `PublisherAccess` から導出する方針）は✅実装済。`getUserKind()`・verified 付き membership・出版社の申請/承認フローは❌未実装（出版社向け機能自体をまだ提供していない）。

---

## 3. ステータス（2軸に分離）

現状は 1 enum に「モデレーション状態」と「出版社の対応状態」が混在。分ける:

```
Report.moderationStatus : PUBLISHED | PENDING_REVIEW | REJECTED        (公開可否)
Report.resolutionStatus : OPEN | ACKNOWLEDGED | WILL_FIX | FIXED | WONT_FIX  (出版社対応)
fixedEdition / fixedPrinting は FIXED に付随
```
- 「却下（スパム）」と「出版社が対応しない（WONT_FIX）」は意味が全く違うのに今は混在。
- 公開ポリシー: **即時公開 + 通報で PENDING_REVIEW に落とす**（性善説 + 事後モデレーション + 監査）。

実装状況: ❌未実装（現状は 1 enum 8値の `ReportStatus` のまま。即時公開の運用のみ実態と一致）。

---

## 4. 公開プラットフォーム必須層（現状の空白）

1. **モデレーション**: `Flag` → 管理キュー `/admin/moderation`。レート制限。新規ユーザーの trust level。
2. **信頼シグナル**: 賛同数、出版社 verified 回答バッジ、投稿者実績。免責バナーは維持。
3. **発見性 / SEO（最重要・伸びしろ最大）**:
   - 本ページ・報告ページを **ISR** 配信、`generateMetadata` で OGP・構造化データ。
   - sitemap.xml / robots、ISBN・書名検索、出版社別一覧。
   - 「〇〇（書名） 正誤表」での検索流入が集客の本体。
4. **通知**: 自分の報告に出版社回答が付いたらメール通知（Resend 等）。
5. **法務・プライバシー**: 免責、退会（GDPR: **§7 の匿名化方針**＝auth.users 削除＋Profile の PII スクラブ・Report は保全）、削除依頼フロー、利用規約。

実装状況: 1=❌未実装。2=🔶一部（賛同数✅・投稿者実績は `/users/[id]` の統計で一部✅・出版社 verified 回答バッジ❌・免責バナー✅維持中）。3=❌未実装（noindex ソフトローンチ中・sitemap 無し・動的レンダリング。public 化時に着手）。4=❌未実装。5=🔶一部（利用規約/プライバシー実ページ＋登録・ログイン画面の同意文言✅・退会=匿名化✅・免責✅。削除依頼フローとモデレーション方針の明文化は❌）。

---

## 5. アーキテクチャ / 技術

- **Next.js 16 App Router**: 公開ページはサーバーコンポーネント + ISR。データは `services/` を直接呼ぶ（HTTP 越し自前 API は外部公開時のみ）。 — 🔶SC + `services/` 直呼びは✅・ISR は❌未導入（動的レンダリング）
- 認可は `services/auth.ts` 集約、admin は layout ガード + proxy の多層防御。 — ✅実装済
- **RLS を締める**: 全アクセスが Prisma（特権ロール）経由なので、全テーブル RLS 有効化 = PostgREST 経由は拒否し、公開 anon キーでの直叩き露出を塞ぐ。**公開前必須**。 — ✅実装済（全テーブル RLS 有効・ポリシー無し=全拒否ロック。認可はサーバー層で行う。→ `docs/learnings.md`）
- 検索: まず Postgres 全文検索（pg_trgm）。 — ❌未実装（現状は一覧のクライアント側フィルタのみ）
- 画像: Supabase Storage、削除はカスケード + ファイル削除を退会・報告削除に統合。 — ❌未実装（`ReportImage` モデルのみ存在・画像投稿機能なし。書影は外部 URL 直リンク方針）
- テスト: `utils/isbn.ts` など純粋関数から Vitest 導入。 — ✅実装済（純粋関数＋コンポーネント/API ルートのユニットテストあり。e2e は Playwright）

---

## 6. 現状からの差分

| 領域 | 今（初版執筆時） | 提案 | 実装状況 |
|---|---|---|---|
| role | ADMIN/PUBLISHER/USER 保存 | ADMIN/USER + membership 導出 | ✅済 |
| 出版社回答 | 文字列カラム | `PublisherResponse` 第一級 | ❌未 |
| status | 8値1軸 | moderation × resolution 2軸 | ❌未 |
| 賛同/通報 | なし | `Confirmation` / `Flag` | 🔶賛同✅（`Upvote`）/ 通報❌ |
| 公開性 | 動的レンダリング | ISR + SEO + sitemap | ❌未（public 化時に着手） |
| RLS | 未設定（露出リスク） | 全有効化で締める | ✅済（全拒否ロック） |
| 命名 | Feedback | Report | ✅済 |

---

## 優先度（ポートフォリオとして効く順）

1. 認可（identity/capability 分離）— 設計力の証明 — 🔶role 縮小✅・membership/verified❌
2. ステータス 2 軸 + モデレーション — 実プロダクト感 — ❌未着手
3. SEO / ISR — 公開で伸びる本体 — ❌未着手（public 化時）
4. RLS 締め — 公開前セキュリティ必須 — ✅完了

全部を一度にやる必要はない。段階移行する。

---

## 7. 確定した運用・整合性ポリシー（実装済み or 決定済み）

※ §1〜6 は将来像（未実装の提案を含む）。この §7 は**現時点で確定・実装済みの方針**を集約する（背景・解説は `docs/learnings.md`、個別の判断ログは Claude メモリ参照）。

### 削除と退会（別々の2系統）
- **管理者によるレポート削除（モデレーション）= 物理削除 + AuditLog 記録**。論理削除は不採用（全クエリに「未削除のみ」条件が要りクエリが複雑化するため）。`ReportImage` は Cascade で削除（Storage 上の画像ファイル実体も削除時に併せて掃除）。実装済 `app/actions/report.ts` の `deleteReport`（ADMIN限定）。
- **ユーザー退会（GDPR）= 投稿者の匿名化（実装済）**。`auth.users` を削除（auth側PII除去）し、`Profile` は残して PII だけスクラブ（`email`→匿名ダミー・`displayName`→null）、`Report` は保全して投稿者を「退会済みユーザー」表示。理由：公開UGCで Report はコミュニティ資産であり、匿名化すれば GDPR 消去権の対象外になるため。実装は `app/actions/auth.ts` の `withdraw`（監査ログには元メール・元表示名を残さず無期限のPII保持を回避）。

### 参照整合性は DB 外部キーで担保（＝画面操作で参照不整合は起きない）
- onDelete マップ: `Report.userId`/`Report.bookId` = **Restrict**（投稿を持つ User/Book は削除不可）、`ReportImage→Report` = Cascade、`PublisherAccess→Profile/Publisher` = Cascade、`Book.publisherId` = 任意だが **Restrict**（出版社削除ガード。optional の既定 SetNull から意図的に変更）。
- 「記事ゼロの Book / Publisher（孤児行）」は**放置で許容**。Book は ISBN で upsert、Publisher は名前照合で、再投稿時に**再利用**される（重複も不整合も作らない）。連動削除は入れない（複雑化＝バグの温床を避ける）。「出版社不明の本」は元データ不完全ゆえの**正規の状態**（publisherId は optional のまま）。

### 出版社削除ガード（案A・実装済）
- 「**書籍が紐づかない出版社のみ削除可**」。保証=DB（`Book.publisherId` の onDelete を SetNull→**Restrict** に変更済み）、UX=アプリ（`app/actions/publisher.ts` の件数チェック＋親切エラー）。
- PublisherAccess は **Cascade のまま**と決着（権限レコードは出版社と運命共同体でよい。Restrict にすると権限保持者がいるだけで削除できず掃除の妨げになる）。

### 認証エラー表示・パスワード再発行
- ログイン失敗は**汎用文言**「メールアドレスまたはパスワードが正しくありません」（アカウント列挙対策。実装済）。どちらが違うか・登録の有無は明かさない。
- 親切さは「パスワードをお忘れですか？」リンク＋再発行フロー（`/auth/reset-password`・実装済）で担保。再発行完了画面も登録有無を明かさない文言にしている。

### ローカル開発環境
- **Supabase CLI ローカル（`supabase start`・Docker）= Auth(GoTrue)+DB+Storage+Studio+Inbucket の完全ミラー**を使う。素の Postgres コンテナ不可（このアプリは Supabase Auth で login/register/PKCE するため）。`.env.local` で切替。リリース前に構築し本番との齟齬を確認（Prisma Migrate 移行・書き込み系 e2e もここで安全に）。

### レスポンシブ
- **Tailwind 標準ブレークポイントを据え置き**（カスタムしない。sm640/md768/lg1024/xl1280/2xl1536・min-width 積み上げ式）。対応は breakpoint の数値変更ではなく「**崩れるコンポーネント単位**」で行う（例：モバイルのテーブル横溢れはカード型化）。

### データアクセスの境界（2026-07 に Server Actions へ統一）
- **読み取り（ページ表示）= サーバーコンポーネントからサービス関数/Prisma を直接 await**。内部利用のためだけの自前 API Route は挟まない（同一プロセス内で HTTP 往復と JSON 二重シリアライズを増やすだけで、分離の実も速度も得られないため）。
- **自アプリ UI からの更新 = Server Actions**（`app/actions/*.ts`）。理由：関数呼び出しの型安全（引数・戻り値をコンパイル時検証）、`useActionState` 等 React 統合、更新と画面反映が1往復で完結（アクション内の `refresh()` / `redirect()`）。エラーは `{ error?: string }` を返し、成功時に一覧へ戻る操作は `redirect()`（publisher.ts 発祥のパターン）。**認可はレンダリングではなく各アクション内で必ず検証する**（アクションは直接 POST 可能な公開エンドポイントであるため。管理系は `requireAdminOrThrow`）。
- **API Route（Route Handler）は「HTTP 境界が本当に必要なもの」だけ**に限定。現存は次の2種のみ：①画像アップロード `POST /api/reports/[id]/images`（Server Actions のボディ上限は既定 1MB。`bodySizeLimit` を緩めると全アクション共通に効いて DDoS 耐性を削るため、大きいバイナリの受口だけ Route Handler に隔離）②外部書誌 API のプロキシ `GET /api/books/openbd`・`/api/books/search`（外部データ源への読み取り窓口）。
