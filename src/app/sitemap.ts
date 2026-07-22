import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { site } from "@/constants/site";
import { routes } from "@/constants/routes";

// 検索エンジンに「見つけて欲しいページ」の一覧を渡す（https://www.sitemaps.org/protocol.html）。
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

  // as const が無いと changeFrequency が string に広がり、Sitemap の列挙型に代入できない
  const staticPages: MetadataRoute.Sitemap = (
    [
      // トップは投稿が増えるたびに変わるので更新頻度が最も高い
      { path: routes.home, changeFrequency: "daily", priority: 1 },
      { path: routes.howToUse, changeFrequency: "monthly", priority: 0.5 },
      { path: routes.tech, changeFrequency: "monthly", priority: 0.5 },
      { path: routes.terms, changeFrequency: "yearly", priority: 0.3 },
      { path: routes.privacy, changeFrequency: "yearly", priority: 0.3 },
    ] as const
  ).map(({ path, ...rest }) => ({ ...rest, url: `${site.url}${path}`, lastModified: new Date() }));

  return [
    ...staticPages,
    // 書籍ページ＝「書名 正誤表」で流入する主戦場なので、投稿ページより優先度を高くする
    ...books.map((book) => ({
      url: `${site.url}${routes.book(book.isbn)}`,
      lastModified: book.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...reports.map((report) => ({
      url: `${site.url}${routes.report(report.id)}`,
      lastModified: report.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
