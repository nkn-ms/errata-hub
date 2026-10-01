import { z } from "zod";
import { normalizeEmailDomain, isValidEmailDomain } from "@/features/publisher/utils/email-domain";

// 出版社の登録・更新フォームの検査（features/publisher/actions/create-publisher.ts・features/publisher/actions/update-publisher.ts が使う）。
const PublisherSchema = z.object({
  name: z.string().min(1, "出版社名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください").or(z.literal("")),
  // 担当者の所属を確かめる一次資料としてのメモ（**権限は付かない** = utils/email-domain.ts）。
  // 照合に使える形だけを通す（`@` 付き・URL・単一ラベルを弾く）。自由記述は note 欄が持つ。
  emailDomain: z
    .string()
    .transform(normalizeEmailDomain)
    .refine((v) => v === "" || isValidEmailDomain(v), {
      message: "メールドメインは example.co.jp の形式で入力してください（@ や http:// は不要）",
    }),
  note: z.string().or(z.literal("")),
});

// 検査を通った出版社の欄（登録と編集で同じ）
export type SubmittedPublisher = z.output<typeof PublisherSchema>;

export function parsePublisherForm(formData: FormData) {
  return PublisherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    emailDomain: formData.get("emailDomain"),
    note: formData.get("note"),
  });
}
