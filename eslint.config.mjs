import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // useActionState 等でシグネチャ上必要だが未使用の引数は `_` プレフィックスで許可する慣習
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // フィーチャーの境界を機械的に守る。依存は shared → features → app の一方向だけ許す。
      //
      // なぜ lint なのか: ディレクトリを切っただけの規約は必ず崩れる。README に書いても
      // 越境した import はレビューでしか止められず、レビューは見落とす。
      // 出典: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // shared がフィーチャーを知ってはいけない（逆流すると shared でなくなる）。
            // 実例: utils/image-compress.ts が constants/report-images を読んでいた＝
            // 名前は shared でも中身は report の道具だった。
            { target: "./src/components", from: "./src/features" },
            { target: "./src/constants", from: "./src/features" },
            { target: "./src/lib", from: "./src/features" },
            { target: "./src/services", from: "./src/features" },
            { target: "./src/utils", from: "./src/features" },

            // フィーチャーがルーティング層を知ってはいけない。
            // ⚠️ `actions` だけ除外している。Server Action はどこに置いてもよく、
            //    `app/actions/` にあるのは慣習で、ルーティングではないため。
            //    残りのフィーチャー（book / publisher / user / auth）を切り出すときに
            //    `src/actions/` などへ移し、この except を外すのが最終形。
            { target: "./src/features", from: "./src/app", except: ["./actions"] },

            // フィーチャー同士は直接つながない（合成は app 層で行う）。
            // ⚠️ フィーチャーを足したら、その分の zone をここに足すこと。
            //    書き忘れると、そのフィーチャーだけ越境し放題になる。
            { target: "./src/features/report", from: "./src/features", except: ["./report"] },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code の作業ディレクトリ。git worktree を切ると .claude/worktrees/<名前>/ に
    // もう1つの作業ツリーができ、そこで dev/build を回すと .next も生える。
    // 上の ".next/**" はルート直下しか見ないので、除外しないと**他の作業ツリーのビルド出力を
    // 検査して 1000 件規模のエラーになる**（実測。lint が落ちる原因が自分の変更に見えて紛らわしい）。
    ".claude/**",
  ]),
]);

export default eslintConfig;
