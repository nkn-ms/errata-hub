import { signInWithGitHub, signInWithGoogle } from "@/features/account/actions/auth";
import { GitHubIcon, GoogleIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

// ソーシャルログインのボタン。ログイン/会員登録の両ページで使う。
// OAuth はどちらの導線でも「未登録なら登録・登録済みならログイン」になるためラベルは共通。

function OAuthButton({
  action,
  icon,
  label,
}: {
  action: () => Promise<void>;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="secondary"
        className="w-full text-gray-700 flex items-center justify-center gap-2"
      >
        {icon}
        {label}
      </Button>
    </form>
  );
}

export function GoogleSignInButton() {
  return (
    <OAuthButton
      action={signInWithGoogle}
      icon={<GoogleIcon className="w-4 h-4" />}
      label="Googleで続ける"
    />
  );
}

export function GitHubSignInButton() {
  return (
    <OAuthButton
      action={signInWithGitHub}
      icon={<GitHubIcon className="w-4 h-4" />}
      label="GitHubで続ける"
    />
  );
}
