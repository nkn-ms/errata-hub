"use client";

import { ErrorContent } from "@/components/error-content";
import { routes } from "@/constants/routes";

// 管理画面の例外境界。admin/layout.tsx の中で描かれるので管理ナビが残る
// （無いとルートの app/error.tsx に落ち、管理者が戻り先を失う。404 = admin/not-found.tsx と同じ理由）。
//
// ⚠️ admin/layout.tsx は requireAdminPage() で認可している。その認可自体が投げた例外は
//    この境界では捕まらず（同じ階層の layout は包まない）、ルートの app/error.tsx に上がる。
export default function AdminError({
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
      action={{ href: routes.admin.reports, label: "投稿一覧へ" }}
    />
  );
}
