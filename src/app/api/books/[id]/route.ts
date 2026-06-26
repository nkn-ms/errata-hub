import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit";
import { TARGET_TYPE } from "@/constants/audit";
import { requireAdmin } from "@/services/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, error } = await requireAdmin();
    if (error) return error;

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "書籍が見つかりません" }, { status: 404 });
    }

    // 投稿が紐づく本は削除させない（出版社削除ガードと同じ「子があれば不可」の方針）。
    // DB 側でも Report.bookId は必須リレーション=Restrict なので二重に守られる。
    const reportCount = await prisma.report.count({ where: { bookId: id } });
    if (reportCount > 0) {
      return NextResponse.json(
        { error: `${reportCount}件の投稿が紐づいているため削除できません。先に投稿を削除してください。` },
        { status: 409 }
      );
    }

    await prisma.book.delete({ where: { id } });

    await createAuditLog({
      userId: user?.id,
      userEmail: user?.email,
      action: "DELETE_BOOK",
      targetType: TARGET_TYPE.BOOK,
      targetId: id,
      before: book as Record<string, unknown>,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
