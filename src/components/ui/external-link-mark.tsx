import { ExternalLink } from "lucide-react";

export function ExternalLinkMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <>
      {/* 既定では svg の下端が文字のベースラインに乗り、字より高く見える。負の値で下げて揃える */}
      <ExternalLink aria-hidden className={`ml-1 inline-block align-[-0.125em] ${className}`} />
      <span className="sr-only">（新しいタブで開きます）</span>
    </>
  );
}
