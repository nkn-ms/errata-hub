import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900">認証エラー</h1>
          <p className="text-sm text-gray-600">
            メール確認リンクが無効か期限切れです。
            再度登録をお試しください。
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/register"
              className="block w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              会員登録へ
            </Link>
            <Link
              href="/login"
              className="block w-full py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
