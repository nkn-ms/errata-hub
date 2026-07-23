import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// ヘッダー（HeaderNav）に渡す現在ユーザー情報をまとめる。表示名の正は Profile.displayName で、
// user_metadata は参照しない（OAuth ログインでは display_name が入らないため）。表示名が無い
// ときのみメールにフォールバック。同じ導出を複数ページ（トップ・/reports）で使うのでここに集約する。
export async function getHeaderUser(): Promise<{ userName: string | null; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userName: null, isAdmin: false };

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { displayName: true, role: true },
  });
  return {
    userName: profile?.displayName || user.email || null,
    isAdmin: profile?.role === "ADMIN",
  };
}
