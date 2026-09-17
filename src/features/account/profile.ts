import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * **Server Action ではない書き込み。** 呼ぶのは認証コールバックの Route Handler で、
 * フォームからは呼ばれない（＝`actions/` には置かない）。
 *
 * ⚠️ **`"use server"` を付けない。** 付けるとクライアントから呼べる口になる。
 */

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
