import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { findAllBookIsbns } from "@/features/book/db/books";
import { findReportsForSitemap } from "@/features/report/db/reports-admin";
import { latestDate } from "@/utils/latest-date";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

// 検索エンジンに「見つけて欲しいページ」の一覧を渡す（https://www.sitemaps.org/protocol.html）。
//
// トップ（app/(site)/page.tsx）は ?page=N のサーバーページネーション、/reports は全投稿の一覧なので、
// 投稿・書籍の各ページはリンクを辿るだけでも到達できる。それでも sitemap を置くのは、
// lastModified（ページの中身が最後に変わった時刻）を投稿・書籍の URL に付けて「新しさ」を直接伝えられ、
// 新規・更新ページの発見が早くなるため（辿れることと、早く見つけてもらえることは別）。
// ⚠️ lastModified は**正確なときだけ付ける**。Google は lastmod が一貫して正確なときだけ使う（下の出典）ので、
//    不正確な値が混ざるとサイトマップ全体の lastmod が信用されなくなる。
//
// 出力するのは url と lastModified だけ。Next.js の API は仕様どおり changefreq / priority も
// 出せるが、書かない。仕様（sitemaps.org）自身が changefreq を「ヒントであり命令ではない」、
// priority を「順位に影響する可能性は低い」としており、Google は明示的にこの2つを無視する
// （lastmod は正確なら使う）。効かない値を書くと、後から読む人が効くものと誤解する。
//   仕様: https://www.sitemaps.org/protocol.html
//   Google: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
//
// 載せるのは公開ページだけ。次は意図的に除外している:
//   - ログイン必須（/submit・/account 配下・/admin 配下）と認証フロー（/auth 配下）
//     … そもそも検索から来ても使えない
//   - /users/[id] … 投稿者のプロフィールを運営側から能動的に検索へ送らない。
//     リンクを辿れば到達できるが、sitemap は「載せてください」という積極的な申告なので分けて考える
//   - 却下（DISMISSED）した投稿 … ページ側でも noindex にしている（理由は reports/[id]/page.tsx）
//
// この URL は app/robots.ts が Sitemap: として宣言している。

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ⚠️ これが無いとビルド時に事前生成されようとして DB に繋ぎにいく。CI の DATABASE_URL は
  // ダミー値なので ECONNREFUSED でビルドが落ちる（実際に落ちた）。connection() は
  // 「ここから先はリクエスト時にだけ実行する」という宣言で、事前生成を打ち切る。
  //   出典: https://nextjs.org/docs/app/api-reference/functions/connection
  //         （同ページ「Synchronous database drivers」の項がこのケースそのもの）
  // sitemap はクローラが稀に取りに来るだけなので、毎回 DB を引くコストは問題にならない。
  await connection();

  const [books, reports] = await Promise.all([
    findAllBookIsbns(),
    findReportsForSitemap(),
  ]);

  // 静的ページには lastModified を付けない。更新日を持たないので、付けるなら今の時刻になり
  // （上の connection() で毎回生成するため）、クロールのたびに「更新された」と申告してしまう
  const staticPages = [
    routes.home,
    routes.reports,
    routes.howToUse,
    routes.tech,
    routes.design,
    routes.terms,
    routes.privacy,
  ].map((path) => ({ url: `${site.url}${path}` }));

  // 書籍ページはその本の投稿を（却下したものも含めて）並べる＝投稿の行が変われば書籍ページの中身も変わる。
  // 追記と回答は書籍ページには出ないので、ここで見るのは行の更新時刻（updatedAt）だけ
  const latestReportUpdateByIsbn = new Map<string, Date>();
  for (const report of reports) {
    latestReportUpdateByIsbn.set(
      report.isbn,
      latestDate(report.updatedAt, latestReportUpdateByIsbn.get(report.isbn))
    );
  }

  return [
    ...staticPages,
    ...books.map((book) => ({
      url: `${site.url}${routes.book(book.isbn)}`,
      lastModified: latestDate(book.updatedAt, latestReportUpdateByIsbn.get(book.isbn)),
    })),
    ...reports
      .filter((report) => report.indexable)
      .map((report) => ({
        url: `${site.url}${routes.report(report.id)}`,
        lastModified: report.pageUpdatedAt,
      })),
  ];
}
