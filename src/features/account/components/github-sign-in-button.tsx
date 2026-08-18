import { signInWithGitHub } from "@/features/account/actions/auth";
import { GitHubIcon } from "@/components/ui/icons";

// GitHub ログインボタン。ログイン/会員登録の両ページで使う。
// OAuth はどちらの導線でも「未登録なら登録・登録済みならログイン」になるためラベルは共通。
export function GitHubSignInButton() {
  return (
    <form action={signInWithGitHub}>
      <button
        type="submit"
        className="w-full py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <GitHubIcon className="w-4 h-4" />
        GitHubで続ける
      </button>
    </form>
  );
}
