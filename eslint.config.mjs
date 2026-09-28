import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// import/no-restricted-paths の違反時に出す文（zone は下の設定）。
const DIRECTION =
  "依存の向きは constants → utils → lib → services → features（components/ 以外）→ usecases → features の components/ → app の1本だけ。";
const SHARED_MESSAGE = `共有の層（constants・utils・lib・services・components/ui）は features と usecases を import しない（読むと共有でなくなる）。${DIRECTION}`;
const CONSTANTS_MESSAGE = `constants は値だけを置く層なので、utils・lib・services を import しない。${DIRECTION}`;
const UTILS_MESSAGE = `utils は外部（DB・認証・fetch）に触らない純粋関数の層なので、lib・services を import しない。${DIRECTION}`;
const LIB_MESSAGE = `lib は外部との口そのもの（クライアントの生成）なので、services を import しない。${DIRECTION}`;
const FEATURES_APP_MESSAGE = `features は app（ルーティング）を import しない。画面を組み立てるのは app の側。${DIRECTION}`;
const USECASES_MESSAGE = `usecases は画面（app・components・features の components/）を import しない。画面から呼ばれる側なので、呼ぶ側を知らない。${DIRECTION}`;
const FEATURE_DATA_MESSAGE = `features の components/ 以外（db・constants・utils・schema・types）は、usecases と画面の部品を import しない。usecases から呼ばれる側なので、呼ぶ側を知らない。${DIRECTION}`;
const FEATURES_MESSAGE =
  "フィーチャー同士（report・book・publisher・account）は import しない。複数のフィーチャーを組み合わせるのは usecases（サーバー側）と app（画面側）だけ。";

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

      // フィーチャーの境界を機械的に守る。依存は下の DIRECTION の一方向だけ許す。
      //
      // なぜ lint なのか: ディレクトリを切っただけの規約は必ず崩れる。README に書いても
      // 越境した import はレビューでしか止められず、レビューは見落とす。
      // 出典: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
      //
      // 各 zone の message は、違反したその場で規則と理由を読めるようにするためのもの
      // （向きを覚えていなくても、間違えた瞬間に正しい置き場所が分かる）。
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // shared がフィーチャーと usecases を知ってはいけない（逆流すると shared でなくなる）。
            // 実例: utils/image-compress.ts が constants/report-images を読んでいた＝
            // 名前は shared でも中身は report の道具だった。
            //
            // ⚠️ `components/layout` は対象外。ヘッダーやフッターは shared のライブラリではなく
            //    **フィーチャーを組み立てて画面の枠を作る合成層**で、app/ と同じ側に立つ。
            //    実例: ヘッダーのユーザーメニューはログアウト（usecases/logout.ts）を持つ。
            //    ここを禁じると、合成のためだけに props を2段バケツリレーすることになる。
            { target: "./src/components/ui", from: ["./src/features", "./src/usecases"], message: SHARED_MESSAGE },
            { target: "./src/constants", from: ["./src/features", "./src/usecases"], message: SHARED_MESSAGE },
            { target: "./src/lib", from: ["./src/features", "./src/usecases"], message: SHARED_MESSAGE },
            { target: "./src/services", from: ["./src/features", "./src/usecases"], message: SHARED_MESSAGE },
            { target: "./src/utils", from: ["./src/features", "./src/usecases"], message: SHARED_MESSAGE },

            // 共有層の内側にも順序を入れる（2026-09-17）。各ディレクトリは「何に依存してよいか」で定義する:
            //   constants（値だけ）→ utils（純粋関数）→ lib（外部との口）→ services（DB・認証に触る横断処理）
            // 下から上へは import できない。これで「新しい共有ファイルをどのディレクトリに置くか」が
            // **「外部（DB・認証・fetch）に触るか」の質問1つ**で決まり、間違えるとここが落ちる。
            //
            // ⚠️ この順序は宣言ではなく**実測**（移行時点で違反ゼロ）。utils/ と constants/ は
            //    prisma・supabase・next/headers を1つも import していなかった。
            { target: "./src/constants", from: "./src/utils", message: CONSTANTS_MESSAGE },
            { target: "./src/constants", from: "./src/lib", message: CONSTANTS_MESSAGE },
            { target: "./src/constants", from: "./src/services", message: CONSTANTS_MESSAGE },
            { target: "./src/utils", from: "./src/lib", message: UTILS_MESSAGE },
            { target: "./src/utils", from: "./src/services", message: UTILS_MESSAGE },
            { target: "./src/lib", from: "./src/services", message: LIB_MESSAGE },

            // フィーチャーがルーティング層を知ってはいけない。
            // 逆向き（app → features）は自由。app は合成層なので、フィーチャーを束ねて画面を作る。
            { target: "./src/features", from: "./src/app", message: FEATURES_APP_MESSAGE },

            // usecases（ブラウザから呼ばれる操作）は、画面の部品より下・データと決まりごとより上に立つ。
            // 同じ features の中で components/ だけが usecases より上にいるので、判定は
            // **「画面の部品かどうか」の1つ**で決まる（何の機能かを知らなくてよい）。
            { target: "./src/usecases", from: ["./src/components", "./src/app"], message: USECASES_MESSAGE },
            { target: "./src/usecases", from: "./src/features/*/components/**/*", message: USECASES_MESSAGE },
            {
              target: ["./src/features/*/!(components)/**/*", "./src/features/*/*.ts"],
              from: ["./src/usecases/**/*", "./src/features/*/components/**/*"],
              message: FEATURE_DATA_MESSAGE,
            },

            // フィーチャー同士は直接つながない。組み合わせるのは usecases（サーバー側）と app（画面側）。
            // ⚠️ フィーチャーを足したら、その分の zone をここに足すこと。
            //    書き忘れると、そのフィーチャーだけ越境し放題になる。
            { target: "./src/features/report", from: "./src/features", except: ["./report"], message: FEATURES_MESSAGE },
            { target: "./src/features/publisher", from: "./src/features", except: ["./publisher"], message: FEATURES_MESSAGE },
            { target: "./src/features/account", from: "./src/features", except: ["./account"], message: FEATURES_MESSAGE },
            { target: "./src/features/book", from: "./src/features", except: ["./book"], message: FEATURES_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    // features の中で prisma を触ってよいのは db/ の中だけ。
    // components・utils・constants・schema・types は DB を知らない。
    //
    // ⭐ **「どこで DB を触るか」を目で追えるようにするための規則。** ディレクトリを見れば分かり、
    //    フィーチャー直下にバラのファイルとして散らない（実際 report-images.ts / profile.ts /
    //    withdrawal.ts が散っていて、開くまで DB を触ると分からなかった）。
    files: ["src/features/**"],
    ignores: ["src/features/*/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "features の中で DB に触るのは features/<name>/db/ だけ。db/ に目的で名前を付けたファイルを作ること（操作の手順は usecases/ に置く）。",
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
