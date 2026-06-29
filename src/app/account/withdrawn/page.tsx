import Link from "next/link";
import { routes } from "@/constants/routes";

// 退会完了ページ。退会後は signOut 済みなので認証は不要（公開ページ）。
// メール通知は送らない方針のため、画面上の完了フィードバックをここで担う。
export default function WithdrawnPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="text-4xl">👋</div>
          <h1 className="text-xl font-bold text-gray-900">退会が完了しました</h1>
          <p className="text-sm text-gray-600">
            ご利用ありがとうございました。アカウントとログイン情報は削除されました。
          </p>
          <p className="text-xs text-gray-400">
            これまでの投稿は「退会済みユーザー」の投稿として残ります。
          </p>
          <div className="pt-2">
            <Link
              href={routes.home}
              className="inline-block text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              トップへ戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
