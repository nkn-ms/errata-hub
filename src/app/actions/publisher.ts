"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminOrThrow } from "@/services/auth";
import { routes } from "@/constants/routes";
import { normalizeEmailDomain, isValidEmailDomain } from "@/utils/email-domain";

const PublisherSchema = z.object({
  name: z.string().min(1, "出版社名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください").or(z.literal("")),
  // ⚠️ ただのメモではなく**アクセス権を付与する条件**（詳細は utils/email-domain.ts）。
  //    無検証だと「大文字・空白・@付き」で無言で効かなくなるので、正規化してから形を見る。
  emailDomain: z
    .string()
    .transform(normalizeEmailDomain)
    .refine((v) => v === "" || isValidEmailDomain(v), {
      message: "メールドメインは example.co.jp の形式で入力してください（@ や http:// は不要）",
    }),
  note: z.string().or(z.literal("")),
});

export type PublisherState = { error?: string } | undefined;

export async function createPublisher(
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  await requireAdminOrThrow();

  const parsed = PublisherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    emailDomain: formData.get("emailDomain"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, email, emailDomain, note } = parsed.data;

  await prisma.publisher.create({
    data: {
      name,
      email: email || null,
      emailDomain: emailDomain || null,
      note: note || null,
    },
  });

  redirect(routes.admin.publishers);
}

export async function updatePublisher(
  id: string,
  _prev: PublisherState,
  formData: FormData
): Promise<PublisherState> {
  await requireAdminOrThrow();

  const parsed = PublisherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    emailDomain: formData.get("emailDomain"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, email, emailDomain, note } = parsed.data;

  await prisma.publisher.update({
    where: { id },
    data: {
      name,
      email: email || null,
      emailDomain: emailDomain || null,
      note: note || null,
    },
  });

  redirect(routes.admin.publishers);
}

export async function deletePublisher(id: string): Promise<PublisherState> {
  await requireAdminOrThrow();

  // 書籍が紐づく出版社は削除させない（UX側のガード）。
  // 最終的な整合性の保証は DB の onDelete: Restrict（Book.publisherId）が担う。
  const bookCount = await prisma.book.count({ where: { publisherId: id } });
  if (bookCount > 0) {
    return {
      error: `この出版社には${bookCount}冊の書籍が紐づいているため削除できません。先に書籍の出版社を付け替えてください。`,
    };
  }

  await prisma.publisher.delete({ where: { id } });
  redirect(routes.admin.publishers);
}
