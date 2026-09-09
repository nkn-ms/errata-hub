import { ExternalLink } from "lucide-react";

// 外部サイトへ別タブで開くリンクに添える印。
//
// 丸括弧に行き先（ホスト）を書いていても「別タブで開く」ことは押す前に分からないので、
// そこだけを担う。⚠️ **アイコンと読み上げ用の文言は必ず対にする**（アイコンだけだと
// 目で見える人にしか伝わらない）。出典: WCAG 2.2 の達成技法 G201（新しいウィンドウで
// 開くことを事前に知らせる） https://www.w3.org/WAI/WCAG22/Techniques/general/G201
//
// サイト内の移動は「→」、戻る導線は「←」で、印の使い分けはこの3種類だけにする。
export function ExternalLinkMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <>
      {/* align は文字のベースラインに合わせるため（インラインの svg は既定で下に落ちる） */}
      <ExternalLink aria-hidden className={`ml-1 inline-block align-[-0.125em] ${className}`} />
      <span className="sr-only">（新しいタブで開きます）</span>
    </>
  );
}
