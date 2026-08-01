"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminOrThrow } from "@/services/auth";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { routes } from "@/constants/routes";
import { normalizeEmailDomain, isValidEmailDomain, isFreeMailDomain } from "@/utils/email-domain";
import { Prisma } from "@/generated/prisma/client";

const PublisherSchema = z.object({
  name: z.string().min(1, "出版社名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください").or(z.literal("")),
  // ⚠️ ただのメモではなく**アクセス権を付与する条件**（詳細は utils/email-domain.ts）。
  //    auth/callback がログイン時にこの値とメールのドメイン部を完全一致で突き合わせ、
  //    一致した出版社の PublisherAccess を自動付与する。だから2段で見る:
  //      - 形 … @ 付き・URL・単一ラベルを通すと、無言で「権限が付かない」設定になる
  //      - フリーメール … 通すとそのサービスの**利用者全員**に権限が付く
  emailDomain: z
    .string()
    .transform(normalizeEmailDomain)
    .refine((v) => v === "" || isValidEmailDomain(v), {
      message: "メールドメインは example.co.jp の形式で入力してください（@ や http:// は不要）",
    })
    .refine((v) => !isFreeMailDomain(v), {
      message:
        "フリーメールのドメインは登録できません（そのサービスの利用者全員に権限が付きます）。特定の担当者に権限を渡すときは、ユーザー管理の画面から個別に付与してください",
    }),
  note: z.string().or(z.literal("")),
});

export type PublisherState = { error?: string } | undefined;

function parsePublisherForm(formData: FormData) {
  return PublisherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    emailDomain: formData.get("emailDomain"),
    note: formData.get("note"),
  });
}

// 出版社名は @unique（投稿時に名前で upsert して名寄せするため = schema.prisma）。
// 同名を作ろうとすると P2002 が飛ぶので、エラーページに落とさず文言で返す。
function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "同じ名前の出版社が既に登録されています";
    if (error.code === "P2025") return "対象の出版社が見つかりません";
  }
  console.error(error);
  return fallback;
}

export async function createPublisher(
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  const admin = await requireAdminOrThrow();

  const parsed = parsePublisherForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, emailDomain, note } = parsed.data;

  try {
    const publisher = await prisma.publisher.create({
      data: {
        name,
        email: email || null,
        emailDomain: emailDomain || null,
        note: note || null,
      },
    });

    // emailDomain はアクセス権の条件なので、誰がいつ設定したかを残す
    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "CREATE_PUBLISHER",
      targetType: TARGET_TYPE.PUBLISHER,
      targetId: publisher.id,
      after: publisher as unknown as Record<string, unknown>,
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の登録に失敗しました") };
  }

  // redirect は制御フロー例外を投げるため try の外で呼ぶ（catch に飲まれないように）
  redirect(routes.admin.publishers);
}

export async function updatePublisher(
  id: string,
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  const admin = await requireAdminOrThrow();

  const parsed = parsePublisherForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, emailDomain, note } = parsed.data;

  try {
    const before = await prisma.publisher.findUnique({ where: { id } });
    const publisher = await prisma.publisher.update({
      where: { id },
      data: {
        name,
        email: email || null,
        emailDomain: emailDomain || null,
        note: note || null,
      },
    });

    // 「誰がドメインを書き換えたか」を後から説明できるよう、変更前後を残す
    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "UPDATE_PUBLISHER",
      targetType: TARGET_TYPE.PUBLISHER,
      targetId: id,
      before: (before ?? null) as unknown as Record<string, unknown> | null,
      after: publisher as unknown as Record<string, unknown>,
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の更新に失敗しました") };
  }

  redirect(routes.admin.publishers);
}

export async function deletePublisher(id: string): Promise<PublisherState> {
  const admin = await requireAdminOrThrow();

  try {
    // 書籍が紐づく出版社は削除させない（UX側のガード）。
    // 最終的な整合性の保証は DB の onDelete: Restrict（Book.publisherId）が担う。
    const bookCount = await prisma.book.count({ where: { publisherId: id } });
    if (bookCount > 0) {
      return {
        error: `この出版社には${bookCount}冊の書籍が紐づいているため削除できません。先に書籍の出版社を付け替えてください。`,
      };
    }

    const publisher = await prisma.publisher.delete({ where: { id } });

    await createAuditLog({
      userId: admin.id,
      userEmail: admin.email,
      action: "DELETE_PUBLISHER",
      targetType: TARGET_TYPE.PUBLISHER,
      targetId: id,
      before: publisher as unknown as Record<string, unknown>,
    });
  } catch (error) {
    return { error: toMessage(error, "出版社の削除に失敗しました") };
  }

  redirect(routes.admin.publishers);
}
