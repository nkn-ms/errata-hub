import Link from "next/link";
import { routes } from "@/constants/routes";

// ⚠️ このファイルは LegalConsentNote 経由でクライアント側（/login・/register は "use client"）からも
//    読み込まれる。サーバー専用のもの（SiteHeader → prisma / supabase server）をここに置くと
//    クライアントバンドルに引きずり込まれて build だけが落ちるので、ページ体裁の LegalShell は
//    legal-shell.tsx に分けている。

// 条見出し＋本文のまとまり。
export function Article({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-2">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// 条文内の番号付きリスト（1. 2. 3. …）。
export function OrderedList({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside space-y-1.5 pl-5 marker:text-gray-400">
      {children}
    </ol>
  );
}

// 番号なしの箇条書き（詳細の列挙）。
export function BulletList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside space-y-1 pl-5 marker:text-gray-400">
      {children}
    </ul>
  );
}

// 登録・ログイン画面の同意文言。規約第2条「利用することにより同意したものとみなす」の
// 建て付けを画面側にも明示する（メール登録とGitHubログインの両方に効くようカード末尾に置く）。
export function LegalConsentNote({ action }: { action: string }) {
  return (
    <p className="text-center text-xs text-gray-400 leading-relaxed">
      {action}することで、
      <Link href={routes.terms} className="text-blue-600 hover:underline">
        利用規約
      </Link>
      および
      <Link href={routes.privacy} className="text-blue-600 hover:underline">
        プライバシーポリシー
      </Link>
      に同意したものとみなされます。
    </p>
  );
}
