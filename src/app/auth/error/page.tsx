import Link from "next/link";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";

// エラーの中身は ?reason= で受け取る（送り元は /auth/callback）。
// 文言を分けるのは、原因ごとに読者が取るべき行動が違うため（やり直せば直る／運営の対応が要る）。
const REASONS = {
  "email-conflict": {
    message:
      "このメールアドレスは、以前作成されたアカウントが使用中のため、新しいアカウントに登録できませんでした。お手数ですが、下記の窓口までご連絡ください。",
    showContact: true,
  },
  profile: {
    message:
      "アカウント情報の作成に失敗しました。時間をおいて再度お試しください。繰り返す場合は下記の窓口までご連絡ください。",
    showContact: true,
  },
} as const;

// reason 無し（＝ code が無い・code の交換に失敗）のときの既定。従来からの文言
const DEFAULT_REASON = {
  message: "メール確認リンクが無効か期限切れです。再度登録をお試しください。",
  showContact: false,
} as const;

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const { message, showContact } =
    (reason && REASONS[reason as keyof typeof REASONS]) || DEFAULT_REASON;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900">認証エラー</h1>
          <p className="text-sm text-gray-600">{message}</p>
          {showContact && (
            <p className="text-sm">
              <a
                href={`mailto:${site.contactEmail}`}
                className="text-blue-600 hover:underline break-all"
              >
                {site.contactEmail}
              </a>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Link
              href={routes.register}
              className="block w-full py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              会員登録へ
            </Link>
            <Link
              href={routes.login}
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
