import Link from "next/link";
import { requireAdminPage } from "@/services/auth";
import { routes } from "@/constants/routes";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 多層防御: proxy.ts のエッジ判定に加え、配下の全 admin ページをここで再ガードする。
  await requireAdminPage();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-sm">Errata Hub</span>
            <span className="text-gray-400 text-xs">管理画面</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={routes.admin.reports} className="text-gray-300 hover:text-white transition-colors">
              投稿
            </Link>
            <Link href={routes.admin.publishers} className="text-gray-300 hover:text-white transition-colors">
              出版社マスタ
            </Link>
            <Link href={routes.admin.books} className="text-gray-300 hover:text-white transition-colors">
              書籍マスタ
            </Link>
            <Link href={routes.admin.users} className="text-gray-300 hover:text-white transition-colors">
              ユーザー管理
            </Link>
            <Link href={routes.admin.logs} className="text-gray-300 hover:text-white transition-colors">
              操作ログ
            </Link>
            <Link href={routes.home} className="text-gray-400 hover:text-white text-xs transition-colors">
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
