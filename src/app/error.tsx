"use client";

import { ErrorContent } from "@/components/error-content";
import { routes } from "@/constants/routes";

// 例外境界の受け皿（最後の砦）。ここに来るのは次の3つ:
//   1. (site) にも admin にも属さない画面 … /login・/register・/auth/*・退会フロー
//      （これらは意図的にヘッダーを持たないので、枠が無いことは仕様どおり）
//   2. (site)/layout.tsx・admin/layout.tsx **自身**が投げた例外
//      （error.tsx は同じ階層の layout を包まないため、1つ上の境界まで上がる）
//   3. 上記の境界を持たない未知の階層
//
// ルート layout.tsx が投げた例外はさらに上＝ app/global-error.tsx が受ける。
export default function RootError({
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
