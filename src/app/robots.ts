import type { MetadataRoute } from "next";
import { site } from "@/constants/site";

// 公開ページはクロールを許可し、認証やユーザー個人の操作に紐づくパスだけ除外する。
// /submit は投稿フォーム（ログイン必須で、検索から直接来ても投稿できない）。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/account/", "/auth/", "/submit"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
