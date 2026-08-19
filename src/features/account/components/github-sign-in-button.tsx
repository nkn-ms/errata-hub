import { signInWithGitHub } from "@/features/account/actions/auth";
import { GitHubIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

// GitHub ログインボタン。ログイン/会員登録の両ページで使う。
// OAuth はどちらの導線でも「未登録なら登録・登録済みならログイン」になるためラベルは共通。
export function GitHubSignInButton() {
  return (
    <form action={signInWithGitHub}>
      <Button
        type="submit"
        variant="secondary"
        className="w-full text-gray-700 flex items-center justify-center gap-2"
      >
        <GitHubIcon className="w-4 h-4" />
        GitHubで続ける
      </Button>
    </form>
  );
}
