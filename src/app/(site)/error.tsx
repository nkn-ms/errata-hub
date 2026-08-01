"use client";

import { ErrorContent } from "@/components/error-content";
import { routes } from "@/constants/routes";

// 公開側ページの例外境界。ここに置くと (site)/layout.tsx の中で描かれる＝共通ヘッダーが残る。
//
// ⚠️ ルートの app/error.tsx では代わりにならない。error.tsx は Client Component である必要があり
//    （React の Error Boundary の制約）、Client Component からは Server Component である
//    SiteHeader / SiteShell を import できない。**レイアウトの子として描かれる**この位置なら、
//    ヘッダーはサーバー側が描いたものがそのまま残る
//    = node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
//
// ⚠️ この境界は**同じ階層の layout.tsx は包まない**。(site)/layout.tsx 自体が投げた例外は
//    ルートの app/error.tsx に上がる（同ファイルの「component hierarchy」の項）。
export default function SiteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorContent
      digest={error.digest}
      onRetry={unstable_retry}
      action={{ href: routes.home, label: "トップへ" }}
    />
  );
}
