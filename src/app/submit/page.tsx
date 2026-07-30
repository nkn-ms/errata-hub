import { ReportForm } from "@/components/report-form";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";
import { toCanonicalIsbn } from "@/utils/isbn";
import { PAGE_CONTAINER, FORM_COLUMN } from "@/constants/layout";

type Props = {
  searchParams: Promise<{ isbn?: string | string[] }>;
};

export default async function SubmitPage({ searchParams }: Props) {
  const { isbn } = await searchParams;

  // 書籍ページの「この本に投稿する」から来たときは、その本を確定済みとしてフォームに渡し、
  // 書籍検索をやり直させない。不正・未登録の ISBN でも 404 にはせず通常の投稿フォームに
  // フォールバックする（対象の本が分からないだけで、投稿自体はできるため）。
  const canonicalIsbn = typeof isbn === "string" ? toCanonicalIsbn(isbn) : null;
  const preselected = canonicalIsbn
    ? await prisma.book.findUnique({
        where: { isbn: canonicalIsbn },
        include: { publisher: true },
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* 枠（左端と最大幅）は全ページ共通。入力欄が横に伸びすぎないよう内側だけ絞る */}
      <main className={`${PAGE_CONTAINER} py-8`}>
        <div className={FORM_COLUMN}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">投稿する</h1>
            <p className="mt-1 text-sm text-gray-500">
              書籍の正誤情報・改善提案を投稿してください。
            </p>
          </div>
          <ReportForm
            initialBook={
              preselected
                ? {
                    // googleBooksId は外部検索結果を区別するためだけの値で、保存もされない。
                    // DB 由来の本には存在しないので空でよい。
                    googleBooksId: "",
                    title: preselected.title,
                    author: preselected.author ?? "",
                    publisher: preselected.publisher?.name ?? "",
                    isbn: preselected.isbn,
                    coverImageUrl: preselected.coverImageUrl ?? "",
                  }
                : null
            }
            // 登録済みの正誤表はサーバー側で分かるので、クライアントから引き直さない
            initialErratumUrl={preselected?.erratumUrl ?? null}
          />
        </div>
      </main>
    </div>
  );
}
