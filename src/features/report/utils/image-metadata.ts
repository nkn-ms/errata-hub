/**
 * 画像ファイルが**撮影情報（EXIF / XMP）を埋め込んでいるか**を、画素をデコードせずに判定する。
 *
 * 撮影情報には撮影した場所の緯度・経度が入ることがある。添付画像は誰でも見られる公開の
 * 置き場所に置くので、そのまま上げると撮影場所（自宅など）が公開される。
 * ブラウザ（utils/image-compress.ts）は撮影情報を落としてから送り（抜けるものは画素に触らず抜く・
 * 抜けないものは描き直す = stripEmbeddedMetadata）、サーバー（api/reports/[id]/images）は
 * 残っていたら受け付けない。両方がこの関数で判定する。
 *
 * ⚠️ **位置情報だけを探さず、撮影情報の入れ物があるかで判定する。** 位置情報は EXIF の中の
 *    GPS 領域にも XMP の中にも書けるので、中身まで読むと読み漏らしの余地が増える。
 *    入れ物ごと落としても、この用途（本の誤りの証拠）で失うものは無い。
 *
 * 形式の出典:
 *   JPEG … APP1 セグメント（EXIF・XMP の両方の入れ物）: https://www.w3.org/Graphics/JPEG/itu-t81.pdf ・ CIPA DC-008（Exif 2.3）
 *   PNG  … eXIf チャンク / テキストチャンクの XMP: https://www.w3.org/TR/png-3/#eXIf
 *   WebP … EXIF / XMP チャンク: https://developers.google.com/speed/webp/docs/riff_container
 */
export function hasEmbeddedMetadata(bytes: Uint8Array): boolean {
  if (isJpeg(bytes)) return jpegHasMetadata(bytes);
  if (isPng(bytes)) return pngHasMetadata(bytes);
  if (isWebp(bytes)) return webpHasMetadata(bytes);
  return false;
}

/**
 * 撮影情報を**画素に触らずに**抜く。抜けないときは null（＝呼び出し側が描き直して落とす）。
 *
 * ⭐ 描き直さずに済ませるための経路。macOS のスクリーンショットは撮影情報（XMP・EXIF）を持つので、
 * 撮影情報があるたびに描き直すと、文字の画像が webp の圧縮で劣化する。
 *
 * null を返すのは2つ:
 *   - **EXIF の向き（Orientation）が「回転なし」以外**: 抜くと横倒しで表示される。
 *     向きを画素に焼き込めるのは描き直しだけ（= utils/image-compress.ts の imageOrientation）
 *   - JPEG / PNG 以外（WebP で撮影情報を持つものは稀なので、描き直しに任せる）
 */
export function stripEmbeddedMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (isJpeg(bytes)) return stripJpegMetadata(bytes);
  if (isPng(bytes)) return stripPngMetadata(bytes);
  return null;
}

const isJpeg = (b: Uint8Array) => b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array) => PNG_SIGNATURE.every((v, i) => b[i] === v);
const isWebp = (b: Uint8Array) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP";

function ascii(b: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...b.subarray(start, start + length));
}

const JPEG_APP1 = 0xe1;
const JPEG_SOS = 0xda; // ここから先は画素データ。撮影情報はこれより前にしか置かれない
const JPEG_EOI = 0xd9;

type JpegSegment = { marker: number; start: number; end: number };

/**
 * JPEG を画素データ（SOS）の手前までセグメントに分ける。`pixelStart` は SOS の位置
 * （そこから末尾までは1塊で扱う）。形が崩れていたら null。
 */
function jpegSegments(b: Uint8Array): { segments: JpegSegment[]; pixelStart: number } | null {
  const segments: JpegSegment[] = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // 詰め物の 0xFF
      continue;
    }
    // ここから先は画素データ。撮影情報はこれより前にしか置かれない
    if (marker === JPEG_SOS || marker === JPEG_EOI) return { segments, pixelStart: i };
    // 長さを持たない単独のマーカー（RSTn・TEM）
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      segments.push({ marker, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
    segments.push({ marker, start: i, end });
    i = end;
  }
  return null;
}

function jpegHasMetadata(b: Uint8Array): boolean {
  // 読めない形は「有る」とする（ブラウザのデコーダは途中のゴミを読み飛ばして表示できるので、
  // 「無い」とすると撮影情報ごと素通しになりうる）。ブラウザ側はこれを描き直しで落とすので、
  // フォームからの投稿は止まらない
  return jpegSegments(b)?.segments.some((seg) => seg.marker === JPEG_APP1) ?? true;
}

const EXIF_HEADER = "Exif\0\0";

function stripJpegMetadata(b: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const parsed = jpegSegments(b);
  if (!parsed) return null;
  const app1 = parsed.segments.filter((seg) => seg.marker === JPEG_APP1);
  for (const seg of app1) {
    const payload = b.subarray(seg.start + 4, seg.end);
    if (ascii(payload, 0, 6) === EXIF_HEADER && exifOrientation(payload.subarray(6)) !== 1) return null;
  }
  const kept = parsed.segments.filter((seg) => seg.marker !== JPEG_APP1);
  return concat([b.subarray(0, 2), ...kept.map((seg) => b.subarray(seg.start, seg.end)), b.subarray(parsed.pixelStart)]);
}

// テキストチャンクのうち撮影情報を運ぶもの。XMP は規格上のキーワード、
// "Raw profile type exif" 等は ImageMagick が EXIF をテキストとして書き出す形
const PNG_TEXT_CHUNKS = new Set(["tEXt", "zTXt", "iTXt"]);

type PngChunk = { type: string; start: number; end: number; isMetadata: boolean };

/** PNG をチャンクに分ける。形が崩れていたら読めたところまで返す */
function pngChunks(b: Uint8Array): PngChunk[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks: PngChunk[] = [];
  let i = PNG_SIGNATURE.length;
  while (i + 8 <= b.length) {
    const length = view.getUint32(i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + length; // 長さ(4)＋種類(4)＋データ＋CRC(4)
    chunks.push({ type, start: i, end, isMetadata: isPngMetadataChunk(b, type, i + 8, length) });
    if (type === "IEND") break;
    i = end;
  }
  return chunks;
}

function isPngMetadataChunk(b: Uint8Array, type: string, dataStart: number, length: number): boolean {
  if (type === "eXIf") return true;
  if (!PNG_TEXT_CHUNKS.has(type)) return false;
  // キーワードは先頭の最大79バイトで、NUL で終わる（PNG 仕様 11.3.2）
  const head = b.subarray(dataStart, dataStart + Math.min(length, 80));
  const end = head.indexOf(0);
  const keyword = ascii(head, 0, end === -1 ? head.length : end);
  return keyword === "XML:com.adobe.xmp" || keyword.startsWith("Raw profile type");
}

function pngHasMetadata(b: Uint8Array): boolean {
  return pngChunks(b).some((chunk) => chunk.isMetadata);
}

function stripPngMetadata(b: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const chunks = pngChunks(b);
  for (const chunk of chunks) {
    if (chunk.type === "eXIf" && exifOrientation(b.subarray(chunk.start + 8, chunk.end - 4)) !== 1) return null;
  }
  const kept = chunks.filter((chunk) => !chunk.isMetadata);
  return concat([b.subarray(0, PNG_SIGNATURE.length), ...kept.map((c) => b.subarray(c.start, c.end))]);
}

function webpHasMetadata(b: Uint8Array): boolean {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 12; // "RIFF" ＋ 全体の長さ ＋ "WEBP"
  while (i + 8 <= b.length) {
    const fourcc = ascii(b, i, 4);
    if (fourcc === "EXIF" || fourcc === "XMP ") return true;
    const size = view.getUint32(i + 4, true);
    i += 8 + size + (size % 2); // チャンクは偶数長に詰められる
  }
  return false;
}

/**
 * EXIF（TIFF 形式）の IFD0 から向き（タグ 0x0112）を読む。無ければ 1（回転なし）。
 * 読めない形なら 0（＝「回転なし」と言い切れない）を返し、呼び出し側を描き直しに倒す。
 * 形式: CIPA DC-008（Exif 2.3）4.6.2・TIFF 6.0 Section 2
 */
function exifOrientation(tiff: Uint8Array): number {
  if (tiff.length < 8) return 0;
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return 0;
  const little = order === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > tiff.length) return 0;
  const count = view.getUint16(ifd, little);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > tiff.length) return 0;
    if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
  }
  return 1;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
