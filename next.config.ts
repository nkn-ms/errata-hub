import type { NextConfig } from "next";
// 値が固定のセキュリティヘッダはここから全ルートに付ける。
// リクエストごとの nonce を含む CSP だけは src/proxy.ts が付ける（理由はそのファイルに）。
import { STATIC_SECURITY_HEADERS } from "./src/utils/security-headers";

const nextConfig: NextConfig = {
  // X-Powered-By: Next.js を消す（使っているフレームワークを自ら名乗らない）
  poweredByHeader: false,

  async headers() {
    return [
      {
        // 全パス（HTML・API・静的アセット）に付ける
        source: "/(.*)",
        headers: [...STATIC_SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
