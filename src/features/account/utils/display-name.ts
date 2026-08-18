import { PROFILE_LIMITS } from "@/features/account/constants";

/**
 * user_metadata の値を Profile.displayName として使える形にする（auth/callback 専用）。
 *
 * ⚠️ **表示名のサーバー検証を迂回できる唯一の入口がここ。** register / updateDisplayName は
 * zod で上限を強制するが、`user_metadata` は Supabase の signUp API を直接叩けば任意の値にでき、
 * OAuth の氏名（full_name）やアカウント名（user_name）も長さが保証されない。
 *
 * ⚠️ ここでは**弾けない**。OAuth の途中でエラーにするとログイン自体が壊れるので、
 * 上限を超えた分は切り詰めるという別の守り方をする（上限の値は3つの入口で共有する）。
 *
 * ⚠️ 型は信用しない。user_metadata は任意の JSON なので `as string` は嘘になり得る。
 * 文字列でなければ null に倒し、呼び出し側の次の候補へ送る。
 */
export function toDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PROFILE_LIMITS.displayName);
}
