"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { AUDIT_ACTION, TARGET_TYPE } from "@/constants/audit";
import { requireAdminServerAction } from "@/services/auth";
import { sanitizeExternalUrl } from "@/utils/external-url";
import type { BookActionState } from "@/features/book/types";

/**
 * 投稿者が申告した正誤表 URL（Report.reportedErratumUrl）を、その本の公式な正誤表
 * （Book.erratumUrl）として採用する。管理画面の投稿詳細からワンクリックで呼ぶ。
 *
 * リンクの公開は管理者の判断を通す、という方針の実装（schema.prisma の Book.erratumUrl 参照）。
 */
// 塊の結果は「採用した」以外に2通りある。文言の組み立ては塊の外に置きたいので、
// どれに当たったかだけを返す（例外で流すと「失敗」と「採用できない」の区別が付かなくなる）。
type AdoptOutcome = "adopted" | "report-not-found" | "no-url";

export async function adoptReportedErratumUrl(reportId: string): Promise<BookActionState> {
  const admin = await requireAdminServerAction();

  let outcome: AdoptOutcome;
  try {
    // 採用（Book.erratumUrl の更新）と監査ログを1つの塊にする（理由は usecases/delete-report.ts の deleteReport）。
    // 申告値の読み出しも塊の中で行う: 監査ログの before に使う値なので、
    // 読んでから書くまでの間に他の変更が入り込まないようにする。
    outcome = await prisma.$transaction<AdoptOutcome>(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: { book: true },
      });
      if (!report) return "report-not-found";

      const url = sanitizeExternalUrl(report.reportedErratumUrl);
      if (!url) return "no-url";

      const updated = await tx.book.update({
        where: { id: report.bookId },
        data: { erratumUrl: url },
      });

      await createAuditLog(
        {
          userId: admin.id,
          userEmail: admin.email,
          action: AUDIT_ACTION.ADOPT_ERRATUM_URL,
          targetType: TARGET_TYPE.BOOK,
          targetId: report.bookId,
          before: { erratumUrl: report.book.erratumUrl },
          after: { erratumUrl: updated.erratumUrl },
        },
        tx
      );

      return "adopted";
    });
  } catch (error) {
    console.error(error);
    return { error: "正誤表URLの採用に失敗しました" };
  }

  if (outcome === "report-not-found") {
    return { error: "投稿が見つかりません" };
  }
  if (outcome === "no-url") {
    return { error: "採用できる正誤表URLがありません" };
  }

  refresh();
  return {};
}
