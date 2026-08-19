"use client";

import Link from "next/link";
import { site } from "@/constants/site";
import { Button } from "@/components/ui/button";

// 例外時の本文。error.tsx（公開側・管理画面・その他）で共有する。
// 枠（ヘッダー・背景・幅）は呼び出し側のレイアウトが持つので、ここは中身だけを描く。
// 404 の NotFoundContent と見た目を揃えてあるが、あちらと違い**再試行のボタンを持つ**
// ＝例外は一時的なことがあり、その場で回復できる場合があるため。
//
// ⚠️ error.message は表示しない。サーバー側の例外は Next.js が本番で汎用文言に差し替えるが、
//    クライアント側の例外は原文がそのまま入るため、内部の事情が画面に出うる。
//    代わりに digest（例外のハッシュ）を出す＝サーバーのログと突き合わせられる識別子で、
//    それ自体は中身を明かさない。

export function ErrorContent({
  digest,
  onRetry,
  action,
}: {
  // 本番でのみ付く。開発中は undefined になることがある
  digest?: string;
  onRetry: () => void;
  action: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-xl font-bold text-gray-900">エラーが発生しました</h1>
      <p className="mt-3 text-sm text-gray-600">
        一時的な問題の可能性があります。再試行しても直らない場合は、時間をおいてからお試しください。
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button type="button" onClick={onRetry} className="block w-full">
          再試行
        </Button>
        <Link
          href={action.href}
          className="block w-full rounded-md border border-gray-300 py-2 text-sm transition-colors hover:bg-gray-50"
        >
          {action.label}
        </Link>
      </div>

      {digest && (
        <p className="mt-6 text-xs text-gray-500">
          解決しないときは、次の識別子を添えて{" "}
          <a href={`mailto:${site.contactEmail}`} className="text-blue-600 hover:underline">
            {site.contactEmail}
          </a>{" "}
          までご連絡ください。
          <br />
          <span className="font-mono">{digest}</span>
        </p>
      )}
    </div>
  );
}
