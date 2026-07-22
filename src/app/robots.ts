import type { MetadataRoute } from "next";
import { site } from "@/constants/site";

// ⚠️ 公開前の検索インデックス除外（一時的）。
// public 化（本番公開）時は、このファイルを下記に差し替える（app/sitemap.ts は実装済み）:
//
//   return {
//     rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/auth/", "/submit"] },
//     sitemap: `${site.url}/sitemap.xml`,
//   };
//
// layout.tsx の metadata.robots（noindex）も合わせて削除すること。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    // 公開前でも sitemap の場所は示しておく（disallow 中はクロールされないので実害はなく、
    // 公開時に rules を緩めるだけで済む）。
    sitemap: `${site.url}/sitemap.xml`,
  };
}
