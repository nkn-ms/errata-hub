// OG 画像（opengraph-image.tsx）共通のサイズ定義と日本語フォント読込。
//
// ImageResponse(satori) はシステムフォントを参照できず、日本語グリフは
// フォントデータを明示的に渡さないと豆腐（□）になる。Noto Sans JP 全量は
// 数MBあるため、Google Fonts の `text=` パラメータで「描画する文字だけ」の
// サブセットを都度取得する（リクエスト内の文字数なら数KB〜数十KB）。
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * 描画テキストに必要なグリフだけの Noto Sans JP (bold) を取得する。
 * 失敗時は null（呼び出し側はフォント指定なしで描画にフォールバック）。
 */
export async function loadJapaneseFont(text: string): Promise<ArrayBuffer | null> {
  try {
    // 重複文字を落としてクエリを短くする（URL 長対策）
    const unique = Array.from(new Set(Array.from(text))).join("");
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(unique)}`;
    const css = await (await fetch(url)).text();
    // UA を偽装しない素の fetch には woff2 でない TTF/OTF の URL が返る（satori が読める形式）
    const resource = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!resource) return null;
    return await (await fetch(resource[1])).arrayBuffer();
  } catch {
    return null;
  }
}
