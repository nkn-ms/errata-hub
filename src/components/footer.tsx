import { site } from "@/constants/site";

// GitHub マーク。lucide-react はブランドアイコンを廃止したため公式マークをインラインで持つ。
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// 全ページ共通フッター。root layout(app/layout.tsx) に配置する。
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">{site.name}</p>
            {/* 日本語を文節境界で折り返す（公開→「公」「開」のような語中改行を防ぐ） */}
            <p className="mt-1 text-xs text-gray-500 max-w-sm [word-break:auto-phrase]">
              {site.description}
            </p>
          </div>

          {/* ヘッダー(sticky)が常時ナビを提供するため、フッターは重複させず
              ヘッダーに無いメタ系リンクのみ置く（将来: 利用規約・プライバシーポリシー）。 */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <GithubMark className="h-4 w-4" />
              ソースコード
            </a>
          </nav>
        </div>

        <p className="mt-6 text-xs text-gray-400">© {year} {site.name}</p>
      </div>
    </footer>
  );
}
