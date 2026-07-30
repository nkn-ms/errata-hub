import { SiteHeader } from "@/components/site-header";
import { PAGE_CONTAINER } from "@/constants/layout";

// 利用規約・プライバシーポリシーの共通体裁。どちらも「戻れるヘッダー＋読みやすい本文幅」で統一する。
//
// ヘッダーは公開側の共通ヘッダー（SiteHeader）をそのまま使う。以前はロゴだけの独自ヘッダーを
// 手書きしていたため、テーマ切り替えもナビも無い亜種になっていた。
//
// 中身の部品（Article・OrderedList・LegalConsentNote）は legal.tsx 側にある。あちらは
// クライアントコンポーネント（/login・/register）からも読まれるので、サーバー専用の
// SiteHeader を含むこのシェルだけを別ファイルにしている。
export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className={`${PAGE_CONTAINER} py-8`}>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="mt-6 space-y-8 text-sm leading-relaxed text-gray-700">
          {children}
        </div>
      </main>
    </div>
  );
}
