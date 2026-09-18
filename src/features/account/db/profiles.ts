import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isWithdrawnEmail, WITHDRAWN_DISPLAY_NAME } from "@/utils/withdrawal";

/**
 * **プロフィールの読み取り（Data Access Layer）。** 条件と根拠は features/report/db/reports.ts の冒頭と同じ。
 *
 * ⭐ **このファイルの存在理由は「email を外へ出さないこと」。** 退会したかどうかは
 *    「メールが匿名化済みドメインか」でしか判定できない（= utils/withdrawal.ts）ので、
 *    判定には email が要る。**判定をここで済ませ、結果の真偽値だけを返す**ことで、
 *    呼び出し側は email を持つ値に触れなくなる。
 */

/** 公開プロフィール（誰でも見られる範囲）。⚠️ email は含めない。 */
export type PublicProfile = {
  id: string;
  /** 退会済みなら「退会済みユーザー」、未設定なら「匿名」に解決済み。 */
  displayName: string;
  isWithdrawn: boolean;
  githubUsername: string | null;
  xUsername: string | null;
  createdAt: Date;
};

/** 本人のアカウント設定に出す範囲。⚠️ email は含めない（画面が出しているのは Supabase 側の値）。 */
export type AccountSettings = {
  displayName: string | null;
  githubUsername: string | null;
  xUsername: string | null;
  createdAt: Date;
};

/** 公開プロフィール1件（存在しなければ null）。 */
export async function findPublicProfile(id: string): Promise<PublicProfile | null> {
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      email: true,
      githubUsername: true,
      xUsername: true,
      createdAt: true,
    },
  });
  if (!profile) return null;

  const withdrawn = isWithdrawnEmail(profile.email);
  return {
    id: profile.id,
    displayName: withdrawn ? WITHDRAWN_DISPLAY_NAME : (profile.displayName ?? "匿名"),
    isWithdrawn: withdrawn,
    // 退会済みなら公開リンクも出さない（表示側で分岐させず、ここで落とす）
    githubUsername: withdrawn ? null : profile.githubUsername,
    xUsername: withdrawn ? null : profile.xUsername,
    createdAt: profile.createdAt,
  };
}

/** 本人のアカウント設定（存在しなければ null）。 */
export function findAccountSettings(userId: string): Promise<AccountSettings | null> {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { displayName: true, githubUsername: true, xUsername: true, createdAt: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// 管理画面用。⚠️ **email を返すのはここだけ**（公開側の PublicProfile は返さない）。
// 管理者は退会の確認入力で対象のメールを照合するため必要で、認可は
// app/admin/layout.tsx の requireAdminPage() が担う。
// ⚠️ ページサイズは引数で受ける（features は app の定数を import できない）。
// ────────────────────────────────────────────────────────────────────────

/** ユーザー管理の1行。 */
export type AdminProfileRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
  publisherAccess: { publisherId: string; publisherName: string }[];
};

/** ユーザー一覧（登録が古い順）と総件数。 */
export async function findProfilesPageForAdmin(
  page: number,
  pageSize: number
): Promise<{ profiles: AdminProfileRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.profile.findMany({
      include: { publisherAccess: { include: { publisher: { select: { name: true } } } } },
      // id での決着はページ跨ぎのズレ防止（理由は utils/pagination.ts）
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.profile.count(),
  ]);

  return { profiles: rows.map(toAdminProfileRow), total };
}

/** ユーザー1件（存在しなければ null）。 */
export async function findProfileForAdmin(id: string): Promise<AdminProfileRow | null> {
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: { publisherAccess: { include: { publisher: { select: { name: true } } } } },
  });
  return profile === null ? null : toAdminProfileRow(profile);
}

type ProfileRowWithAccess = {
  id: string;
  email: string;
  displayName: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
  publisherAccess: { publisherId: string; publisher: { name: string } }[];
};

function toAdminProfileRow(profile: ProfileRowWithAccess): AdminProfileRow {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    createdAt: profile.createdAt,
    publisherAccess: profile.publisherAccess.map((access) => ({
      publisherId: access.publisherId,
      publisherName: access.publisher.name,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────
// ログイン後に Profile を用意する。**Server Action ではない**（呼ぶのは認証コールバックの
// Route Handler で、フォームからは呼ばれない）ので actions/ には置かない。
// ⚠️ "use server" を付けない。付けるとクライアントから呼べる口になる。
// ────────────────────────────────────────────────────────────────────────

export type EnsureProfileResult =
  | { ok: true }
  /** 退会を経ずに auth ユーザーだけを消して同じメールで登録し直した場合。下のコメント参照。 */
  | { ok: false; reason: "email-conflict" }
  | { ok: false; reason: "profile" };

/**
 * ログイン後に Profile が無ければ作る（あれば何もしない）。
 *
 * 規約への同意は Profile 作成時（＝このサービスを初めて使う瞬間）にだけ刻む。`update: {}` なのは
 * 「同意したのはこの版・この時点」という事実を後のログインで上書きしないため。
 *
 * ⚠️ ここでは出版社アクセスを一切付けない。以前は Publisher.emailDomain とメールのドメイン部を
 *    突き合わせて自動付与していたが、**人の判断を経ない常時付与**になるため廃止した
 *    （退職者・大企業の無関係な人・後からそのドメインのアドレスを取得した人にも付いてしまう。
 *     一般的な auto-join 機能は DNS でドメイン所有を証明させるが、ここにはその仕組みが無い）。
 *    付与は管理画面のユーザー編集からの個別付与だけ = actions/user.ts の grantPublisherAccess。
 *
 * ⚠️ **例外を投げずに理由を返す。** 呼び出し側（callback）は失敗時にセッションを畳んでから
 *    エラーページへ送る必要があり、投げると「ログインできるが Profile が無い」状態が残る。
 */
export async function ensureProfile(params: {
  id: string;
  email: string;
  displayName: string | null;
  termsVersion: string;
}): Promise<EnsureProfileResult> {
  try {
    await prisma.profile.upsert({
      where: { id: params.id },
      update: {},
      create: {
        id: params.id,
        email: params.email,
        displayName: params.displayName,
        role: "USER",
        termsAgreedAt: new Date(),
        termsVersion: params.termsVersion,
      },
    });
    return { ok: true };
  } catch (e) {
    // upsert は id（＝auth の UUID）で判定するので、退会を経ずに auth ユーザーだけを消して
    // 同じメールで登録し直すと、旧 Profile が email（@unique）を握ったまま create に進んで
    // P2002 になる（正規の退会なら email は deleted-<uuid>@deleted.local にスクラブ済みで衝突しない）。
    // 詳細は docs/learnings.md「落とし穴：同じメールで再登録すると壊れる」。
    console.error(e);
    const isEmailConflict =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    return { ok: false, reason: isEmailConflict ? "email-conflict" : "profile" };
  }
}
