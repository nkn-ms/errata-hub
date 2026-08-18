// 利用規約・プライバシーポリシーの共通体裁（見出し＋読みやすい本文の行間）。
//
// 枠（背景・共通ヘッダー・本文の幅）は app/(site)/layout.tsx が持つので、ここは中身だけを整える。
//
// 中身の部品（Article・OrderedList・LegalConsentNote）は legal.tsx 側にある。あちらは
// クライアントコンポーネント（/login・/register）からも読まれるので、
// サーバー専用のものを混ぜないよう分けている。
export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <div className="mt-6 space-y-8 text-sm leading-relaxed text-gray-700">{children}</div>
    </>
  );
}
