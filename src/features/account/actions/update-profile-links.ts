"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import { updateProfileLinks } from "@/features/account/db/profiles";
import type { ProfileState } from "@/features/account/types";

// 空文字は「未設定に戻す」として null に落とす。URL ではなくユーザー名で保存し、
// 表示側で https://github.com/... を組み立てる（任意 URL を貼らせない＝リンク先偽装の余地を断つ）。
const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/; // 英数字とハイフン39文字以内・先頭末尾/連続ハイフン不可

const X_USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/; // 英数字とアンダースコア15文字以内

const ProfileLinksSchema = z.object({
  githubUsername: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || GITHUB_USERNAME_RE.test(v), {
      message: "GitHubのユーザー名の形式が正しくありません（英数字とハイフン、39文字以内）",
    }),
  xUsername: z
    .string()
    .trim()
    // URL やハンドルをそのまま貼る人向けに @ 前置きだけは剥がして受け付ける
    .transform((v) => v.replace(/^@/, ""))
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || X_USERNAME_RE.test(v), {
      message: "Xのユーザー名の形式が正しくありません（英数字とアンダースコア、15文字以内）",
    }),
});

/**
 * 公開リンク（GitHub / X）の変更（本人のセルフサービス）。
 *
 * ログイン手段とは独立した自己申告のプロフィール項目。本人が入力した場合のみ公開される。
 */
export async function updateProfileLinksAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = ProfileLinksSchema.safeParse({
    githubUsername: formData.get("githubUsername") ?? "",
    xUsername: formData.get("xUsername") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.login);
  }

  try {
    await updateProfileLinks(user.id, parsed.data);
  } catch (error) {
    // Profile 行が無い（P2025）等の失敗はエラーページにせず、他アクションと同じく {error} を返す
    console.error(error);
    return { error: "公開リンクの更新に失敗しました" };
  }

  // features/account/actions/update-display-name.ts と同じ理由で `revalidatePath` ではなく `refresh` を使う
  refresh();
  return { success: true };
}
