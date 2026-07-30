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
