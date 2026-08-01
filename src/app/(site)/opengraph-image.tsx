import { ImageResponse } from "next/og";
import { OG_SIZE, OG_CONTENT_TYPE, loadJapaneseFont } from "@/lib/og";
import { site } from "@/constants/site";

// 公開側の既定の OG 画像。
//
// これが無かったので、**トップや /reports・/tech などを SNS に貼っても画像の無いカード**になっていた
// （投稿詳細・書籍詳細だけが自前の画像を持っていた）。
//
// ⚠️ 置き場所が (site) なのは、この規約ファイルが**その階層と配下のページに継承される**ため。
//    ここに置くと公開側の全ページが既定でこの画像を持ち、投稿詳細・書籍詳細は各自の
//    opengraph-image.tsx で上書きする。ルート（app/）に置くと /login・/register・/auth/* まで
//    対象になるが、それらは検索・共有の対象外なので (site) で足りる。
//
// 中身は固定（引数を取らない）。ページごとに変えるべき情報はそれぞれの詳細ページが持っている。
export const alt = `${site.name} — ${site.description}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  // 描画する文字だけのサブセットを取る（理由は lib/og.ts）
  const fontData = await loadJapaneseFont(`${site.name}${site.description}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          padding: 96,
          fontFamily: "NotoSansJP",
        }}
      >
        {/* サービス名。詳細ページのカードでも同じ青を使っているので、並んだときに同じ出所だと分かる */}
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: "#2563eb" }}>
          {site.name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 40,
            color: "#4b5563",
            lineHeight: 1.4,
          }}
        >
          {site.description}
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
