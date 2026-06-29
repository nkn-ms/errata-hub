export default function ResetPasswordSentPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="text-xl font-bold text-gray-900">メールを確認してください</h1>
          <p className="text-sm text-gray-600">
            入力されたメールアドレスが登録済みの場合、パスワード再設定用のリンクを送信しました。
            メール内のリンクをクリックして新しいパスワードを設定してください。
          </p>
          <p className="text-xs text-gray-400">
            リンクの有効期限は1時間です。期限切れの場合は再度お試しください。
          </p>
          <p className="text-xs text-gray-400">
            メールが届かない場合は迷惑メールフォルダをご確認ください。
          </p>
        </div>
      </div>
    </div>
  );
}
