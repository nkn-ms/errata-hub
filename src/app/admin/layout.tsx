import Link from "next/link";
import { requireAdminPage } from "@/services/auth";
import { routes } from "@/constants/routes";

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
          <nav className="flex items-center gap-4 text-sm">
            <Link href={routes.admin.reports} className="text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors">
              投稿
            </Link>
            <Link href={routes.admin.publishers} className="text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors">
              出版社マスタ
            </Link>
            <Link href={routes.admin.books} className="text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors">
              書籍マスタ
            </Link>
            <Link href={routes.admin.users} className="text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors">
              ユーザー管理
            </Link>
            <Link href={routes.admin.logs} className="text-gray-300 hover:text-white dark:text-gray-600 dark:hover:text-gray-900 transition-colors">
              操作ログ
            </Link>
            <Link href={routes.home} className="text-gray-300 hover:text-white dark:text-gray-500 dark:hover:text-gray-900 text-xs transition-colors">
              ← サイトへ戻る
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
