"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminOrThrow } from "@/services/auth";
import { routes } from "@/constants/routes";

const PublisherSchema = z.object({
  name: z.string().min(1, "出版社名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください").or(z.literal("")),
  emailDomain: z.string().or(z.literal("")),
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

export async function deletePublisher(id: string): Promise<void> {
  await requireAdminOrThrow();
  await prisma.publisher.delete({ where: { id } });
  redirect(routes.admin.publishers);
}
