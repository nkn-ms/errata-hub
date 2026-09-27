"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 公開掲示板なのでログアウト後もゲストとして閲覧できる。トップに戻すのが自然。
  redirect(routes.home);
}
