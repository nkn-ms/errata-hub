import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { requireAdminPage } from "@/services/auth";
import { routes } from "@/constants/routes";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 多層防御: proxy.ts のエッジ判定に加え、配下の全 admin ページをここで再ガードする。
  await requireAdminPage();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* この帯は light でも既に暗い面なので、テーマ変数の反転だけだと dark で真っ白に裏返る。
          ここだけ dark: で当て直して「暗いまま」にする。
          ⚠️ 読み方の注意: dark 側はトークンの明度が反転しているので、**明るくしたいほど数字が大きくなる**
          （dark の gray-900 = 最も明るい）。globals.css の対応表を参照。 */}
      <header className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-sm">Errata Hub</span>
            {/* この帯は light でも暗い面なので、濃くした gray-400 では読めなくなる（3.67:1）。
                ここだけ 300 を使う＝暗い面の上では「薄いグレー」の方が読める（12.05:1） */}
            <span className="text-gray-300 dark:text-gray-500 text-xs">管理画面</span>
          </div>
          {/* 現在地は NavLink が背景色＋太字＋aria-current で示す（管理画面は画面数が多く、
              どの一覧を見ているか分からなくなる）。
              この帯は light/dark とも暗い面なので、現在地は**面を反転させる**＝明るいグレーの地に
              濃い文字を乗せる。当初は「一段明るいグレー」＝ gray-800 にしていたが、帯（gray-900）との
              明度差が1段しかなく実機で選択が読み取れなかった。加えて gray-800 は下の
              ThemeToggle の hover 色と同じで、「今いる場所」と「マウスが乗っただけ」が同じ見た目になる。
              ⚠️ dark 側は明度の梯子が逆さなので番号も反転する（light 200 ↔ dark 800・globals.css の対応表）。 */}
          <nav className="flex items-center gap-1 text-sm">
            {[
              { href: routes.admin.reports, label: "投稿" },
              { href: routes.admin.publishers, label: "出版社マスタ" },
              { href: routes.admin.books, label: "書籍マスタ" },
              { href: routes.admin.users, label: "ユーザー管理" },
              { href: routes.admin.logs, label: "操作ログ" },
            ].map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1 text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors"
                activeClassName="bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              >
                {item.label}
              </NavLink>
            ))}
            <Link href={routes.home} className="text-gray-300 hover:text-white dark:text-gray-500 dark:hover:text-gray-900 text-xs transition-colors">
              ← サイトへ戻る
            </Link>
            {/* 管理画面には公開側ヘッダーが出ないので、ここに置かないと管理者は
                テーマを変えるためだけに公開側へ戻ることになる。帯の中身（表・フォーム）は
                テーマで変わるので、切り替え口はこの画面にも要る。
                色は帯に合わせて上書きする（既定は明るい面向け。この帯は light/dark とも暗い面）。 */}
            <ThemeToggle className="text-gray-300 hover:bg-gray-800 hover:text-white dark:text-gray-600 dark:hover:bg-gray-200 dark:hover:text-gray-900" />
          </nav>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
