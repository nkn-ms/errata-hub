import type { MetadataRoute } from "next";

// ⚠️ 公開前の検索インデックス除外（一時的）。
// public 化（本番公開）時に、このファイルを「Allow: / + sitemap」を返す
// 通常の robots に差し替える。layout.tsx の metadata.robots も合わせて削除すること。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
