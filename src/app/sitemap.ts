import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

// 検索エンジンに「見つけて欲しいページ」の一覧を渡す（https://www.sitemaps.org/protocol.html）。
//
// このサイトでは必須。投稿一覧はクライアントサイドのページネーション（1ページ10件・
// components/report-table.tsx）で、2ページ目以降の行は HTML に現れず URL も変わらないため、
// 投稿が10件を超えると古い投稿と書籍ページへはリンクを辿って到達できなくなる。
// sitemap がそれらを検索エンジンに知らせる唯一の経路になる。
//
// 出力するのは url と lastModified だけ。sitemap 仕様には changefreq / priority もあるが、
// Google はこの2つを使わない（lastmod は使う）ので、効かない値を書いて後から読む人を
// 誤解させないために出さない。
//   出典: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
//
// 載せるのは公開ページだけ。次は意図的に除外している:
//   - ログイン必須（/submit・/account 配下・/admin 配下）と認証フロー（/auth 配下）
//     … そもそも検索から来ても使えない
//   - /users/[id] … 投稿者のプロフィールを運営側から能動的に検索へ送らない。
//     リンクを辿れば到達できるが、sitemap は「載せてください」という積極的な申告なので分けて考える
//
// ⚠️ public 化までは app/robots.ts が全体を disallow しているため、この sitemap は参照されない。
// 公開時に robots を「Allow: / ＋ sitemap: <このURL>」へ差し替えること。
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [books, reports] = await Promise.all([
    prisma.book.findMany({ select: { isbn: true, updatedAt: true } }),
    prisma.report.findMany({ select: { id: true, updatedAt: true } }),
  ]);

  // 静的ページは更新日を持たないので、ビルド（再検証）時刻を lastModified にする
  const builtAt = new Date();
  const staticPages = [routes.home, routes.howToUse, routes.tech, routes.terms, routes.privacy].map(
    (path) => ({ url: `${site.url}${path}`, lastModified: builtAt })
  );

  return [
    ...staticPages,
    ...books.map((book) => ({
      url: `${site.url}${routes.book(book.isbn)}`,
      lastModified: book.updatedAt,
    })),
    ...reports.map((report) => ({
      url: `${site.url}${routes.report(report.id)}`,
      lastModified: report.updatedAt,
    })),
  ];
}
