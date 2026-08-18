import { REPORT_IMAGE_BUCKET } from "@/features/report/constants/report-images";

/**
 * Supabase Storage の公開 URL（…/storage/v1/object/public/report-images/<path>）から
 * バケット内パス <path> を取り出す。Storage のファイル削除 API はパスを要求するため、
 * DB に保存した公開 URL から逆算する用途。該当バケットの URL でなければ null。
 */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${REPORT_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length);
  return path ? decodeURIComponent(path) : null;
}
