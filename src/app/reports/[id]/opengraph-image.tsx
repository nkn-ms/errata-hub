import { ImageResponse } from "next/og";
import { findReportById } from "@/services/report";
import { mapReport } from "@/utils/mappers";
import { OG_SIZE, OG_CONTENT_TYPE, loadJapaneseFont } from "@/lib/og";

export const alt = "投稿の概要";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const typeBadgeColors: Record<string, { bg: string; fg: string }> = {
  正誤情報: { bg: "#f3e8ff", fg: "#7e22ce" },
  改善提案: { bg: "#cffafe", fg: "#0e7490" },
  その他: { bg: "#f3f4f6", fg: "#4b5563" },
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await findReportById(id);
  // 存在しない ID でも画像自体は返す（OG クローラーに 500 を返さない）
  const report = raw ? mapReport(raw) : null;

  const title = report?.title ?? "投稿が見つかりません";
  const bookLine = report ? [report.bookTitle, report.publisher].filter(Boolean).join(" / ") : "";
  const type = report?.type ?? "その他";
  const badge = typeBadgeColors[type] ?? typeBadgeColors["その他"];

  const fontData = await loadJapaneseFont(`Errata Hub${title}${bookLine}${type}`);

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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              backgroundColor: badge.bg,
              color: badge.fg,
              borderRadius: 9999,
              padding: "8px 28px",
              fontSize: 32,
            }}
          >
            {type}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            fontSize: 64,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.35,
            // satori は -webkit-line-clamp 相当をサポート（長文タイトルの省略）
            lineClamp: 3,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 36, color: "#4b5563", lineClamp: 1, maxWidth: 800 }}>
            {bookLine}
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
