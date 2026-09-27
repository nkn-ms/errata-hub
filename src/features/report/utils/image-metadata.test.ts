import { describe, it, expect } from "vitest";
import { hasEmbeddedMetadata, stripEmbeddedMetadata } from "./image-metadata";

// 実物の画像ファイルは置かず、判定に効く構造（セグメント・チャンクの並び）だけを組み立てる。
// 画素データの中身は判定に使わないので空でよい。

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number) => u32be(n).reverse();

// ── JPEG ──
const segment = (marker: number, payload: number[] | string) => {
  const data = typeof payload === "string" ? [...payload].map((c) => c.charCodeAt(0)) : payload;
  const length = data.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...data];
};
const SOI = [0xff, 0xd8];
const SOS_AND_PIXELS = [0xff, 0xda, 0x00, 0x02, 0x12, 0x34, 0xff, 0xd9];

// ── PNG ──
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const chunk = (type: string, data: number[] | string) => {
  const d = typeof data === "string" ? [...data].map((c) => c.charCodeAt(0)) : data;
  return [...u32be(d.length), ...[...type].map((c) => c.charCodeAt(0)), ...d, 0, 0, 0, 0];
};
const IHDR = chunk("IHDR", new Array(13).fill(0));
const IDAT = chunk("IDAT", [1, 2, 3]);
const IEND = chunk("IEND", []);

// ── WebP ──
const riff = (...chunks: number[][]) => {
  const body = chunks.flat();
  return bytes("RIFF", u32le(body.length + 4), "WEBP", body);
};
const webpChunk = (fourcc: string, data: number[]) =>
  [...[...fourcc].map((c) => c.charCodeAt(0)), ...u32le(data.length), ...data, ...(data.length % 2 ? [0] : [])];

describe("hasEmbeddedMetadata（撮影情報の入れ物があるか）", () => {
  it("JPEG: APP1（EXIF）があれば true", () => {
    expect(hasEmbeddedMetadata(bytes(SOI, segment(0xe0, "JFIF\0"), segment(0xe1, "Exif\0\0MM"), SOS_AND_PIXELS))).toBe(true);
  });

  it("JPEG: APP1 が無ければ false（画素データの中の 0xFFE1 には反応しない）", () => {
    expect(hasEmbeddedMetadata(bytes(SOI, segment(0xe0, "JFIF\0"), [0xff, 0xda, 0x00, 0x02, 0xff, 0xe1, 0xff, 0xd9]))).toBe(false);
  });

  it("JPEG: 形が崩れて読めないものは true（素通しにしない。ブラウザ側は描き直しで落とせる）", () => {
    expect(hasEmbeddedMetadata(bytes(SOI, [0x00, 0x00], segment(0xe1, "Exif\0\0MM"), SOS_AND_PIXELS))).toBe(true);
  });

  it("PNG: eXIf チャンクがあれば true", () => {
    expect(hasEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("eXIf", "MM\0*"), IDAT, IEND))).toBe(true);
  });

  it("PNG: XMP（macOS のスクリーンショットが必ず持つ）も true", () => {
    expect(hasEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("iTXt", "XML:com.adobe.xmp\0\0\0\0\0<x/>"), IDAT, IEND))).toBe(true);
  });

  it("PNG: 撮影情報でないテキスト（作成ソフト名など）は false", () => {
    expect(hasEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("tEXt", "Software\0GIMP"), IDAT, IEND))).toBe(false);
  });

  it("WebP: EXIF / XMP チャンクがあれば true", () => {
    expect(hasEmbeddedMetadata(riff(webpChunk("VP8X", new Array(10).fill(0)), webpChunk("VP8 ", [1, 2, 3]), webpChunk("EXIF", [1])))).toBe(true);
    expect(hasEmbeddedMetadata(riff(webpChunk("VP8 ", [1, 2, 3]), webpChunk("XMP ", [1, 2])))).toBe(true);
  });

  it("WebP: 画素だけなら false（canvas から書き出した webp はこの形）", () => {
    expect(hasEmbeddedMetadata(riff(webpChunk("VP8 ", [1, 2, 3])))).toBe(false);
  });

  it("画像でないものは false（形式の検査は MIME と Storage 側の役目）", () => {
    expect(hasEmbeddedMetadata(bytes("dummy"))).toBe(false);
  });
});

// EXIF（TIFF・ビッグエンディアン）。IFD0 に向き（0x0112）を1つだけ持つ。null なら向きのタグ無し
const tiff = (orientation: number | null) => [
  ..."MM\0*".split("").map((c) => c.charCodeAt(0)),
  ...u32be(8),
  ...(orientation === null
    ? [0, 0]
    : [0, 1, 0x01, 0x12, 0, 3, ...u32be(1), 0, orientation, 0, 0]),
  ...u32be(0),
];
const exifApp1 = (orientation: number | null) => segment(0xe1, [..."Exif\0\0".split("").map((c) => c.charCodeAt(0)), ...tiff(orientation)]);

describe("stripEmbeddedMetadata（画素に触らず撮影情報だけ抜く）", () => {
  it("PNG: XMP を抜き、残りのチャンクはバイト単位でそのまま残す", () => {
    const input = bytes(PNG_SIG, IHDR, chunk("iTXt", "XML:com.adobe.xmp\0\0\0\0\0<x/>"), chunk("tEXt", "Software\0GIMP"), IDAT, IEND);
    const stripped = stripEmbeddedMetadata(input);

    expect(stripped).toEqual(bytes(PNG_SIG, IHDR, chunk("tEXt", "Software\0GIMP"), IDAT, IEND));
    expect(hasEmbeddedMetadata(stripped!)).toBe(false);
  });

  it("PNG: 向きが「回転なし」か向きの無い eXIf は抜く", () => {
    expect(stripEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("eXIf", tiff(1)), IDAT, IEND))).toEqual(bytes(PNG_SIG, IHDR, IDAT, IEND));
    expect(stripEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("eXIf", tiff(null)), IDAT, IEND))).toEqual(bytes(PNG_SIG, IHDR, IDAT, IEND));
  });

  it("PNG: 回転の要る eXIf・読めない eXIf は抜かない（抜くと横倒しになるので描き直しに回す）", () => {
    expect(stripEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("eXIf", tiff(6)), IDAT, IEND))).toBeNull();
    expect(stripEmbeddedMetadata(bytes(PNG_SIG, IHDR, chunk("eXIf", "MM\0*"), IDAT, IEND))).toBeNull();
  });

  it("JPEG: 回転なしなら APP1 だけ抜き、画素データ（SOS 以降）はそのまま残す", () => {
    const input = bytes(SOI, segment(0xe0, "JFIF\0"), exifApp1(1), segment(0xe1, "http://ns.adobe.com/xap/1.0/\0<x/>"), SOS_AND_PIXELS);
    const stripped = stripEmbeddedMetadata(input);

    expect(stripped).toEqual(bytes(SOI, segment(0xe0, "JFIF\0"), SOS_AND_PIXELS));
    expect(hasEmbeddedMetadata(stripped!)).toBe(false);
  });

  it("JPEG: 回転の要るものは抜かない（スマホの縦向き写真＝向き 6 が典型）", () => {
    expect(stripEmbeddedMetadata(bytes(SOI, exifApp1(6), SOS_AND_PIXELS))).toBeNull();
  });

  it("WebP は抜かない（描き直しに任せる）", () => {
    expect(stripEmbeddedMetadata(riff(webpChunk("VP8 ", [1, 2, 3]), webpChunk("EXIF", [1])))).toBeNull();
  });
});
