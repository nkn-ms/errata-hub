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
            //
            // ⚠️ `components/layout` は対象外。ヘッダーやフッターは shared のライブラリではなく
            //    **フィーチャーを組み立てて画面の枠を作る合成層**で、app/ と同じ側に立つ。
            //    実例: ヘッダーのユーザーメニューはログアウト（account の Server Action）を持つ。
            //    ここを禁じると、合成のためだけに props を2段バケツリレーすることになる。
            { target: "./src/components/ui", from: "./src/features" },
            { target: "./src/constants", from: "./src/features" },
            { target: "./src/lib", from: "./src/features" },
            { target: "./src/services", from: "./src/features" },
            { target: "./src/utils", from: "./src/features" },

            // 共有層の内側にも順序を入れる（2026-09-17）。各ディレクトリは「何に依存してよいか」で定義する:
            //   constants（値だけ）→ utils（純粋関数）→ lib（外部との口）→ services（DB・認証に触る横断処理）
            // 下から上へは import できない。これで「新しい共有ファイルをどのディレクトリに置くか」が
            // **「外部（DB・認証・fetch）に触るか」の質問1つ**で決まり、間違えるとここが落ちる。
            //
            // ⚠️ この順序は宣言ではなく**実測**（移行時点で違反ゼロ）。utils/ と constants/ は
            //    prisma・supabase・next/headers を1つも import していなかった。
            { target: "./src/constants", from: "./src/utils" },
            { target: "./src/constants", from: "./src/lib" },
            { target: "./src/constants", from: "./src/services" },
            { target: "./src/utils", from: "./src/lib" },
            { target: "./src/utils", from: "./src/services" },
            { target: "./src/lib", from: "./src/services" },

            // フィーチャーがルーティング層を知ってはいけない。
            // 逆向き（app → features）は自由。app は合成層なので、フィーチャーを束ねて画面を作る。
            { target: "./src/features", from: "./src/app" },

            // フィーチャー同士は直接つながない（合成は app 層で行う）。
            // ⚠️ フィーチャーを足したら、その分の zone をここに足すこと。
            //    書き忘れると、そのフィーチャーだけ越境し放題になる。
            { target: "./src/features/report", from: "./src/features", except: ["./report"] },
            { target: "./src/features/publisher", from: "./src/features", except: ["./publisher"] },
            { target: "./src/features/account", from: "./src/features", except: ["./account"] },
            { target: "./src/features/book", from: "./src/features", except: ["./book"] },
          ],
        },
      ],
    },
  },
  {
    // features の中で prisma を触ってよいのは db/ と actions/ の中だけ。
    // components・utils・constants・schema は DB を知らない。
    //
    // ⭐ **「どこで DB を触るか」を目で追えるようにするための規則。** ディレクトリを見れば分かり、
    //    フィーチャー直下にバラのファイルとして散らない（実際 report-images.ts / profile.ts /
    //    withdrawal.ts が散っていて、開くまで DB を触ると分からなかった）。
    files: ["src/features/**"],
    ignores: ["src/features/*/db/**", "src/features/*/actions/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "DB に触るのは features/<name>/db/ と features/<name>/actions/ の中だけ。db/ に目的で名前を付けたファイルを作ること。",
            },
          ],
        },
      ],
    },
  },

  {
    // DB に触るのは features/<name>/db/ の読み取りと services/ の中だけ。
    // ページは DTO を受け取って並べるだけにする。
    //
    // 出典: node_modules/next/dist/docs/01-app/02-guides/data-security.md
    //   「Data Access Layer は新規プロジェクト向け／page.tsx への直書きはプロトタイプ向け」
    //   「We recommend choosing one data fetching approach and avoiding mixing them.」
    //
    // ⚠️ **テストは対象外**（Route Handler の unit は prisma をモジュールごとモックするため
    //    `vi.mock("@/lib/prisma")` で名前を書く必要がある）。
    files: ["src/app/**"],
    ignores: ["src/app/**/*.test.ts", "src/app/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "ページから DB を直接叩かない。features/<name>/db/ に置いて、そこから DTO を受け取ること。",
            },
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
