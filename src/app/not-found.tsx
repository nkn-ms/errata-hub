import { NotFoundContent } from "@/components/not-found-content";
import { SiteShell } from "@/components/site-shell";
import { routes } from "@/constants/routes";

// 404 の画面。2つの入口をここが受け持つ:
//   1. どのルートにも一致しない URL（例 /nosuchpage）
//   2. ページが notFound() を呼んだとき（/books/[isbn]・/reports/[id]・/users/[id]）
//
// ⚠️ ルート（app/直下）に置くこと。未一致 URL 全体を受け持てるのはルートの not-found だけで、
//    app/(site)/not-found.tsx に置くと 1 が Next.js 既定の画面（ヘッダーもフッターも無い）に戻る
//    = node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md
//    その代わりルートには (site) のレイアウトが掛からないので、枠は SiteShell を自分で巻く。
//    フッターはルートの layout.tsx が持っているのでここには要らない。
//
// ⚠️ HTTP のステータスは「本文のストリーミングが始まる前に notFound() に到達したか」で決まる。
//    始まっていれば 200＋<meta name="robots" content="noindex">（いわゆる soft 404）になり、
//    始まっていなければ 404 が返る。今は Suspense 境界も loading.tsx も無いので 404 になる
//    （実測: `next start` に curl して確認）。
//    ⚠️ 将来 loading.tsx / Suspense を入れるなら、ここが 200 に変わることを織り込むこと
//    （検索エンジン向けには noindex が付くので致命的ではないが、e2e の期待値は壊れる）
//    = node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md「Status Codes」
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent
        // 原因を断定しない: 未一致 URL と「消えた投稿」の両方がここに来るため
        message="お探しのページは見つかりませんでした。URL が変わったか、投稿や書籍が削除された可能性があります。"
        // 戻り先はトップだけ。トップは最新の投稿一覧と検索ボックス（/reports?q= へ委譲）を
        // 兼ねているので、投稿を探す導線もこの1つに含まれている
        action={{ href: routes.home, label: "トップへ" }}
      />
    </SiteShell>
  );
}
