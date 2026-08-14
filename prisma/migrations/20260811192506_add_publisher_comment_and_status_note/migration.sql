-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "statusNote" TEXT;

-- CreateTable
CREATE TABLE "PublisherComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "byAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublisherComment_reportId_idx" ON "PublisherComment"("reportId");

-- CreateIndex
CREATE INDEX "PublisherComment_publisherId_idx" ON "PublisherComment"("publisherId");

-- CreateIndex
CREATE INDEX "PublisherComment_authorId_idx" ON "PublisherComment"("authorId");

-- AddForeignKey
ALTER TABLE "PublisherComment" ADD CONSTRAINT "PublisherComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherComment" ADD CONSTRAINT "PublisherComment_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherComment" ADD CONSTRAINT "PublisherComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS（全拒否ロック）。⚠️ ここに書くのは、これが Prisma の管理外で「テーブルを足すたびに手で当てる」
-- 運用になっており、実際に RateLimit で漏れたため（docs/dev-environment.md §9）。
-- migration に含めれば本番の migrate deploy で一緒に当たる。ポリシーは足さない＝全拒否のまま。
-- アプリへの影響は無い（Prisma は所有者ロールで繋ぎ、テーブル所有者は RLS を迂回する）
ALTER TABLE "PublisherComment" ENABLE ROW LEVEL SECURITY;

-- ここから下はデータの移行。
--
-- Report.publisherComment は**2つの意味を兼ねていた**列で、そのままでは移せない:
--   ①出版社からの回答（管理者が代理で記録したもの）
--   ②「その他」ステータスのときに ReportUpdateSchema が書かせていた運営者の事情説明
--     （例:「出版社が廃業しており連絡が取れません」）
-- ②を PublisherComment へ入れると、廃業したという説明をその出版社の発言として掲示してしまう。
-- status で読み分けて振り分ける。
--
-- ⚠️ 列自体は消さない（expand-contract）。切り戻せるようにこのリリースでは残し、次の掃除で DROP する。

-- ① 「その他」の説明 → 運営者の補足として statusNote へ
UPDATE "Report"
SET "statusNote" = "publisherComment"
WHERE "publisherComment" IS NOT NULL
  AND "status" = 'OTHER';

-- ② 出版社が紐づいていない書籍（Book.publisherId は nullable）の投稿。
--    「どの出版社としての発言か」を埋められないので、こちらも運営者の補足として残す
UPDATE "Report" r
SET "statusNote" = r."publisherComment"
FROM "Book" b
WHERE r."bookId" = b."id"
  AND r."publisherComment" IS NOT NULL
  AND r."status" <> 'OTHER'
  AND b."publisherId" IS NULL;

-- ③ 残り = 出版社からの回答。列に書けたのは管理者だけなので byAdmin（代理記載）で移す。
--    authorId は NULL＝「誰が書いたかの記録が無い」（列は書き手を持っていなかった）。
--    createdAt は投稿の updatedAt で近似する。正確な記入時刻は残っていないが、
--    updatedAt は「その時点で回答が存在していた」ことが確実に言える時刻の中で最も近い
INSERT INTO "PublisherComment" ("id", "reportId", "publisherId", "body", "authorId", "byAdmin", "createdAt")
SELECT gen_random_uuid()::text, r."id", b."publisherId", r."publisherComment", NULL, true, r."updatedAt"
FROM "Report" r
JOIN "Book" b ON b."id" = r."bookId"
WHERE r."publisherComment" IS NOT NULL
  AND r."status" <> 'OTHER'
  AND b."publisherId" IS NOT NULL;
