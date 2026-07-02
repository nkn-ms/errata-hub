import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

/** 現在の賛同数を返す共通処理。 */
function countUpvotes(reportId: string) {
  return prisma.upvote.count({ where: { reportId } });
}

// 賛同を付ける。自分の投稿には不可・同一投稿への重複は @@unique 制約で冪等に扱う。
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const report = await prisma.report.findUnique({ where: { id }, select: { userId: true } });
    if (!report) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (report.userId === user.id) {
      return NextResponse.json({ error: "自分の投稿には賛同できません" }, { status: 403 });
    }

    try {
      await prisma.upvote.create({ data: { reportId: id, profileId: user.id } });
    } catch (e) {
      // P2002 = unique 制約違反（すでに賛同済み）。二重クリック等を想定し成功扱いにする。
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }

    return NextResponse.json({ upvoted: true, count: await countUpvotes(id) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "賛同に失敗しました" }, { status: 500 });
  }
}

// 賛同を取り消す。未賛同でも成功扱い（deleteMany で冪等）。
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await prisma.upvote.deleteMany({ where: { reportId: id, profileId: user.id } });

    return NextResponse.json({ upvoted: false, count: await countUpvotes(id) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "賛同の取り消しに失敗しました" }, { status: 500 });
  }
}
