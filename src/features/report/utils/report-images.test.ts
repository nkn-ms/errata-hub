import { describe, it, expect } from "vitest";
import { storagePathFromPublicUrl } from "./report-images";

describe("storagePathFromPublicUrl", () => {
  it("公開URLからバケット内パスを取り出す", () => {
    expect(
      storagePathFromPublicUrl(
        "http://127.0.0.1:54321/storage/v1/object/public/report-images/abc/uuid.png"
      )
    ).toBe("abc/uuid.png");
    expect(
      storagePathFromPublicUrl(
        "https://example.supabase.co/storage/v1/object/public/report-images/r1/f.jpg"
      )
    ).toBe("r1/f.jpg");
  });

  it("URL エンコードされたパスはデコードする", () => {
    expect(
      storagePathFromPublicUrl(
        "https://example.supabase.co/storage/v1/object/public/report-images/r1/f%20name.png"
      )
    ).toBe("r1/f name.png");
  });

  it("別バケット・無関係な URL は null", () => {
    expect(
      storagePathFromPublicUrl("https://example.supabase.co/storage/v1/object/public/other/f.png")
    ).toBeNull();
    expect(storagePathFromPublicUrl("https://books.google.com/cover.jpg")).toBeNull();
    expect(
      storagePathFromPublicUrl("https://example.supabase.co/storage/v1/object/public/report-images/")
    ).toBeNull();
  });
});
