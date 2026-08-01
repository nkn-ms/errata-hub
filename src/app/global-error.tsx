"use client";

// ルート layout.tsx 自身が壊れたときの最後の受け皿。**このファイルはルート layout を置き換える**ので、
// html / body を自分で出す必要がある。
//
// ⚠️ グローバル CSS・フォント・テーマがここには届かない（この画面は独自の document を描くため）。
//    したがって Tailwind のクラスは効かない＝**素のインラインスタイルで書く**。
//    OS のダーク設定にも追従しない（テーマは globals.css と layout.tsx の初期化スクリプトが
//    持っているが、どちらもここでは読み込まれない）。地は白・文字は黒で固定される。
//    出典: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
//         「Global Error」の項
//
// ⚠️ metadata / generateMetadata は Client Component では使えないので、題名は React の <title> で出す。
//
// 戻り先を Link ではなく素の <a> にしているのは、ルートのレイアウトが壊れている状況では
// クライアント側遷移が同じ壊れた状態を踏みうるため。全体を読み込み直す方が回復の見込みが高い。
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          color: "#111827",
          backgroundColor: "#ffffff",
        }}
      >
        <title>エラーが発生しました - Errata Hub</title>
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>エラーが発生しました</h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#4b5563" }}>
            画面を表示できませんでした。時間をおいてからお試しください。
          </p>

          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                padding: "0.5rem",
                fontSize: "0.875rem",
                color: "#ffffff",
                backgroundColor: "#111827",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              再試行
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                この画面に限り素の <a> が正しい。ルートのレイアウトが壊れている状況では
                クライアント側遷移が同じ壊れた状態を踏みうるので、全体を読み込み直して回復させる。
                （このリポジトリの内部リンクは他は全て next/link） */}
            <a
              href="/"
              style={{
                padding: "0.5rem",
                fontSize: "0.875rem",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                textDecoration: "none",
              }}
            >
              トップへ
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#6b7280" }}>
              エラー識別子: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
