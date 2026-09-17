import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // tsconfig の paths（@/* → ./src/*）を Vite ネイティブ機能で解決
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Data Access Layer は `import "server-only"` でクライアントからの import を禁じている
      // （= features/<name>/queries.ts）。このパッケージは `react-server` の export 条件で
      // 中身が切り替わり、条件が付かない実行環境では**読み込むだけで throw する**実装が選ばれる。
      // Next.js のビルドでは条件が付くので本番の防御は効いたままで、ここは Vitest だけの読み替え。
      // 出典: https://www.npmjs.com/package/server-only
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
