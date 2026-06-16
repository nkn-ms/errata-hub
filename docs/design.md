# 設計方針

目的: **一般公開される誤字・正誤情報プラットフォーム × ポートフォリオ**。

前提認識: これは「投稿フォーム付き CRUD」ではなく、**信頼性が命の UGC コンテンツ・プラットフォーム**。
誰でも任意の本に「ここが誤り」と書ける = 信頼性・モデレーション・発見性（SEO）が製品の本体。

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
- **Feedback → Report** に改名（実体は「正誤報告」）。
- **出版社コメントを文字列カラム → `PublisherResponse` エンティティへ昇格**（誰が・いつ・どの肩書きで・複数回答・編集履歴）。
- **Confirmation（賛同）追加** — 重複報告を「別レコード乱立」でなく「賛同が集まる」形に誘導。公開 DB の信頼性とノイズ除去の生命線。

---

## 2. 認可モデル（identity と capability の分離）

| 概念 | 持ち方 | source of truth |
|---|---|---|
| サイト管理者か | `Profile.role = ADMIN \| USER` | 保存 |
| 出版社担当か／どの出版社か | `PublisherMembership`（per-publisher） | 保存 |
| 「出版社ユーザー」表示 | membership があるかで導出 | 派生 |

- 3者モデル（管理者・一般・出版社）は `getUserKind()` で読み手に見せる。スキーマには重複を持たない → role と access の同期ズレが構造的に消える。
- 出版社化は「メールドメイン一致で**申請候補** → 管理者承認 or ドメイン所有検証」。ドメイン一致だけで公式回答権を与えない（なりすまし対策）。`PublisherMembership.verified`。

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

---

## 4. 公開プラットフォーム必須層（現状の空白）

1. **モデレーション**: `Flag` → 管理キュー `/admin/moderation`。レート制限。新規ユーザーの trust level。
2. **信頼シグナル**: 賛同数、出版社 verified 回答バッジ、投稿者実績。免責バナーは維持。
3. **発見性 / SEO（最重要・伸びしろ最大）**:
   - 本ページ・報告ページを **ISR** 配信、`generateMetadata` で OGP・構造化データ。
   - sitemap.xml / robots、ISBN・書名検索、出版社別一覧。
   - 「〇〇（書名） 正誤表」での検索流入が集客の本体。
4. **通知**: 自分の報告に出版社回答が付いたらメール通知（Resend 等）。
5. **法務・プライバシー**: 免責、退会（GDPR: auth.users + Profile + 画像まで削除）、削除依頼フロー、利用規約。

---

## 5. アーキテクチャ / 技術

- **Next.js 16 App Router**: 公開ページはサーバーコンポーネント + ISR。データは `services/` を直接呼ぶ（HTTP 越し自前 API は外部公開時のみ）。
- 認可は `services/auth.ts` 集約、admin は layout ガード + proxy の多層防御。
- **RLS を締める**: 全アクセスが Prisma（特権ロール）経由なので、全テーブル RLS 有効化 = PostgREST 経由は拒否し、公開 anon キーでの直叩き露出を塞ぐ。**公開前必須**。
- 検索: まず Postgres 全文検索（pg_trgm）。
- 画像: Supabase Storage、削除はカスケード + ファイル削除を退会・報告削除に統合。
- テスト: `utils/isbn.ts` など純粋関数から Vitest 導入。

---

## 6. 現状からの差分

| 領域 | 今 | 提案 |
|---|---|---|
| role | ADMIN/PUBLISHER/USER 保存 | ADMIN/USER + membership 導出 |
| 出版社回答 | 文字列カラム | `PublisherResponse` 第一級 |
| status | 8値1軸 | moderation × resolution 2軸 |
| 賛同/通報 | なし | `Confirmation` / `Flag` |
| 公開性 | 動的レンダリング | ISR + SEO + sitemap |
| RLS | 未設定（露出リスク） | 全有効化で締める |
| 命名 | Feedback | Report |

---

## 優先度（ポートフォリオとして効く順）

1. 認可（identity/capability 分離）— 設計力の証明
2. ステータス 2 軸 + モデレーション — 実プロダクト感
3. SEO / ISR — 公開で伸びる本体
4. RLS 締め — 公開前セキュリティ必須

全部を一度にやる必要はない。段階移行する。
