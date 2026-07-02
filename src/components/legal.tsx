import Link from "next/link";
import { routes } from "@/constants/routes";

// 利用規約・プライバシーポリシーの共通体裁。どちらも「戻れるヘッダー＋読みやすい本文幅」で統一する。
export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link
            href={routes.home}
            className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors"
          >
            Errata Hub
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="mt-6 space-y-8 text-sm leading-relaxed text-gray-700">
          {children}
        </div>
      </main>
    </div>
  );
}

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
