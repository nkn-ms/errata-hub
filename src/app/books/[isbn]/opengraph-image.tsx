import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { OG_SIZE, OG_CONTENT_TYPE, loadJapaneseFont } from "@/lib/og";
import { toCanonicalIsbn } from "@/utils/isbn";

export const alt = "書籍の投稿一覧";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ isbn: string }> }) {
  const { isbn } = await params;
  const book = await prisma.book.findUnique({
    // 非正規な ISBN でも本体ページと同じ本を指すよう正規形に寄せる（見つからなければ既定の文言）
    where: { isbn: toCanonicalIsbn(isbn) ?? isbn },
    include: { publisher: true, _count: { select: { reports: true } } },
  });

  const title = book?.title ?? "書籍が見つかりません";
  const subLine = book ? [book.author, book.publisher?.name].filter(Boolean).join(" / ") : "";
  const countLabel = book ? `正誤情報・改善提案 ${book._count.reports}件` : "";

  const fontData = await loadJapaneseFont(`Errata Hub${title}${subLine}${countLabel}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f9fafb",
          padding: 64,
          fontFamily: "NotoSansJP",
        }}
      >
        {countLabel && (
          <div style={{ display: "flex" }}>
            <div
              style={{
                backgroundColor: "#dbeafe",
                color: "#1d4ed8",
                borderRadius: 9999,
                padding: "8px 28px",
                fontSize: 32,
              }}
            >
              {countLabel}
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            fontSize: 68,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.35,
            lineClamp: 3,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 36, color: "#4b5563", lineClamp: 1, maxWidth: 800 }}>
            {subLine}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#2563eb" }}>
            Errata Hub
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "NotoSansJP", data: fontData, style: "normal" as const, weight: 700 as const }]
        : undefined,
    }
  );
}
