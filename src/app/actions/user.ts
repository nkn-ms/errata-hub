"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { scrubProfileForWithdrawal, authUserExists } from "@/services/withdrawal";
import { isWithdrawnEmail, withdrawalConfirmationLabel } from "@/lib/withdrawal";
import type { Publisher, PublisherAccess } from "@/generated/prisma/client";

const RoleSchema = z.enum(["ADMIN", "USER"]);

export type UserActionState = { error?: string };

export async function updateUserRole(profileId: string, role: string): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = RoleSchema.safeParse(role);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    // 自分自身のロールは変えられない。**管理者が0人になる状態を構造的に防ぐ**ため。
    // ロールを減らせる操作はこれだけなので、自己降格さえ塞げば「誰かは必ず ADMIN」が保たれる
    // （他人を降格させても、降格させた本人が ADMIN のまま残るため）。
    // 0人になるとアプリからは誰も戻せず、DB を直接触るしかなくなる＝取り返しがつかない。
    //
    // 昇格方向も一緒に塞ぐのは、規則を単純に保つため（自分を ADMIN にする意味は無い）。
    // 代行退会の「自分自身は対象にできない」と同じ考え方 = withdrawUserAsAdmin。
    //
    // ⚠️ 代償として、**管理者が1人の間はその人が退会できない**（本人退会にも管理者ガードが
    //    あるため）。2026-08-04 に運営者が承知のうえで受け入れた仕様で、不具合ではない
    //    ＝ actions/auth.ts の withdraw に詳細。
    if (profileId === admin.id) {
      return { error: "自分自身のロールは変更できません。他の管理者に依頼してください" };
    }

    // ロール変更と監査ログを1つの塊にする（理由は actions/report.ts の deleteReport）。
    // 行に残るのは現在のロールだけなので、**誰が昇格させたかは監査ログにしか残らない**。
    await prisma.$transaction(async (tx) => {
      const before = await tx.profile.findUnique({ where: { id: profileId } });
      const profile = await tx.profile.update({
        where: { id: profileId },
        data: { role: parsed.data },
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.UPDATE_USER_ROLE,
          targetType: TARGET_TYPE.PROFILE,
          targetId: profileId,
          before: { role: before?.role },
          after: { role: profile.role },
        },
        tx
      );
    });

    // 更新後の内容を同一レスポンスで画面に反映する（旧 router.refresh() 相当）
    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "更新に失敗しました" };
  }
}

export type PublisherAccessWithPublisher = PublisherAccess & { publisher: Publisher };
export type GrantPublisherAccessResult =
  | { access: PublisherAccessWithPublisher; error?: undefined }
  | { access?: undefined; error: string };

export async function grantPublisherAccess(
  profileId: string,
  publisherId: string
): Promise<GrantPublisherAccessResult> {
  const admin = await requireAdminServerAction();

  try {
    const parsed = z.string().uuid().safeParse(publisherId);
    if (!parsed.success) {
      return { error: "出版社の指定が不正です" };
    }

    // 付与と監査ログを1つの塊にする。行にも出所（grantedBy*）が残るが、剥奪すると行ごと
    // 消えるので、**権限が存在した事実の履歴は監査ログにしか残らない**（剥奪側と対称にする）。
    const access = await prisma.$transaction(async (tx) => {
      const created = await tx.publisherAccess.create({
        // 付与の出所を行に持たせる（「なぜこの人が権限を持つのか」を出版社の画面から説明できるように）。
        // メールも控えるのは、付与した管理者が後に退会しても記録が読めるようにするため
        // （退会は匿名化＝ id は残るが email はスクラブされる）。
        data: {
          profileId,
          publisherId: parsed.data,
          grantedById: admin.id,
          grantedByEmail: admin.email,
        },
        include: { publisher: true, profile: { select: { email: true } } },
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.GRANT_PUBLISHER_ACCESS,
          targetType: TARGET_TYPE.PUBLISHER_ACCESS,
          targetId: profileId,
          // ⚠️ targetEmail は**誰に付与したか**（userEmail は操作した管理者であって対象者ではない）。
          //    ID だけだと後から DB で名寄せしないと読めず、退会・削除されると辿れなくなる。
          //    publisherName を残しているのと同じ考え方で、当時の値をそのまま持たせる。
          after: {
            targetEmail: created.profile.email,
            publisherId: parsed.data,
            publisherName: created.publisher.name,
          },
        },
        tx
      );

      return created;
    });

    return { access };
  } catch (error) {
    console.error(error);
    return { error: "追加に失敗しました" };
  }
}

/**
 * 管理者による代行退会（スパム・規約違反・テスト垢の始末）。
 *
 * 「削除」ではなく本人の退会（actions/auth.ts の withdraw）と同じ処理を管理者が代行する。
 * Profile 行そのものは消さない: Report.userId が Restrict で消せない上に、
 * ログイン不可・PII 消去という目的はスクラブだけで達成できるため
 * （残るのは表示名 null・メールがダミーの抜け殻＝ [孤児行は許容] の判断と同じ）。
 *
 * ⚠️ 取り消せない。本人が再登録しても UUID が変わるので過去の投稿とは結び付かない。
 * そのため「押し間違い」を止める防御を4つ重ねている:
 *   1) 対象の表示名（無ければメール）を手入力させ、サーバー側でも照合する
 *   2) 自分自身は対象にできない（最後の管理者が自分を消す事故を構造的に防ぐ）
 *   3) ADMIN ロールは直接できない（先に「一般」へ落とす2手順を踏ませる）
 *   4) 監査ログに「どの管理者が誰を」を残す
 */
export async function withdrawUserAsAdmin(
  profileId: string,
  confirmation: string
): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    if (profileId === admin.id) {
      return { error: "自分自身を退会させることはできません" };
    }

    const target = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!target) {
      return { error: "ユーザーが見つかりません" };
    }
    // Profile がスクラブ済みでも、auth.users が残っていれば「途中で止まった退会」なので
    // ここから完了させられるようにする（= 取り残しを回収する管理者側の経路）。
    // 完了しているものだけを弾く。判定の理由は services/withdrawal.ts の authUserExists。
    if (isWithdrawnEmail(target.email) && !(await authUserExists(profileId))) {
      return { error: "このユーザーは既に退会済みです" };
    }
    if (target.role === "ADMIN") {
      return { error: "管理者は退会させられません。先にロールを「一般」に変更してください" };
    }
    if (confirmation !== withdrawalConfirmationLabel(target)) {
      return { error: "確認のため、表示された名前をそのまま入力してください" };
    }

    const result = await scrubProfileForWithdrawal(profileId);
    if (!result.ok) {
      if (result.reason === "withdrawal-incomplete") {
        // 書き戻しにも失敗し、スクラブ済みなのにログインできる状態が残った。
        // 誰も気づけないまま放置されるのを防ぐために記録する（発見は /admin/logs）。
        // 本人からも、この画面からもう一度実行しても完了させられる。
        try {
          await createAuditLog({
            userId: admin.id,
            userEmail: admin.email,
            action: AUDIT_ACTION.WITHDRAWAL_INCOMPLETE,
            targetType: TARGET_TYPE.PROFILE,
            targetId: profileId,
          });
        } catch (error) {
          console.error("未完了の退会を記録できませんでした:", profileId, error);
        }
      }
      return { error: "退会処理に失敗しました。時間をおいて再度お試しください。" };
    }

    // 監査ログには実行した管理者を残す一方、対象の元メール・元表示名は残さない。
    // ここに残すと auth.users 削除後にこの UUID からメールを辿れる唯一の場所になり、
    // 無期限で PII を保持することになってしまうため（本人退会と同じ扱い）。
    //
    // ⚠️ 本人退会（actions/auth.ts の withdraw）と同じ理由で**塊にできない**（上の
    //    scrubProfileForWithdrawal が Supabase の admin API を叩く）。倒す方向も揃える:
    //    退会は既に成立して取り消せないので、記録の失敗で「失敗しました」とは返さない。
    try {
      await createAuditLog({
        userId: admin.id,
        userEmail: admin.email,
        action: AUDIT_ACTION.ADMIN_WITHDRAW_USER,
        targetType: TARGET_TYPE.PROFILE,
        targetId: profileId,
        after: result.scrubbed,
      });
    } catch (error) {
      console.error("代行退会の監査ログを記録できませんでした:", profileId, error);
    }

    refresh();
    return {};
  } catch (error) {
    console.error(error);
    return { error: "退会処理に失敗しました" };
  }
}

export async function revokePublisherAccess(
  profileId: string,
  publisherId: string
): Promise<UserActionState> {
  const admin = await requireAdminServerAction();

  try {
    // 付与側と同じく形を検査する（片方だけ素通しだと、同じ値を送っても結果が割れる）
    const parsed = z.string().uuid().safeParse(publisherId);
    if (!parsed.success) {
      return { error: "出版社の指定が不正です" };
    }

    // 剥奪と監査ログを1つの塊にする。行ごと消えるので、**権限が存在した事実は監査ログにしか残らない**。
    const revoked = await prisma.$transaction(async (tx) => {
      const publisher = await tx.publisher.findUnique({ where: { id: parsed.data } });
      // 誰から剥奪したかを記録に残すため（付与側と対称。理由はあちらのコメント）
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { email: true },
      });

      // deleteMany は対象が無くても成功する。**0件のまま監査ログを書くと「剥奪した」という
      // 起きていない操作の記録が残る**ので、消えた件数で分岐する。
      // 記録は後から説明するためのものなので、事実でない行を増やさないことが目的。
      const { count } = await tx.publisherAccess.deleteMany({
        where: { profileId, publisherId: parsed.data },
      });
      if (count === 0) return false;

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.REVOKE_PUBLISHER_ACCESS,
          targetType: TARGET_TYPE.PUBLISHER_ACCESS,
          targetId: profileId,
          before: {
            targetEmail: profile?.email,
            publisherId: parsed.data,
            publisherName: publisher?.name,
          },
        },
        tx
      );

      return true;
    });

    if (!revoked) {
      return { error: "このユーザーはその出版社のアクセス権を持っていません" };
    }

    return {};
  } catch (error) {
    console.error(error);
    return { error: "削除に失敗しました" };
  }
}
