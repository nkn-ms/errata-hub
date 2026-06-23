@AGENTS.md

# Git 運用の安全ルール（本番反映の保護）

このプロジェクトは Vercel が `main` から本番デプロイする。事故防止のため:

- **本番反映（`origin/main` への push / PR マージ）は必ず事前にユーザーの許可を取ってから実行する。** 無人・autonomous 実行中も例外なし。
- **autonomous 実行中は `main` を checkout しない。** ローカル `main` は常に `origin/main` の鏡に保つ（誤 push の火種を断つ）。
- マージは GitHub の PR 経由で行う（ローカル `git merge` はしない）。
- feature ブランチの push は自由（Preview デプロイ＋バックアップになるため推奨）。
- 詳細フロー: feature ブランチ → push で出る Vercel Preview URL で実機確認 → OK なら PR を main マージ。CI グリーンだけで main マージに走らない。

これらは `.claude/settings.local.json` の deny（`git merge *` / `git push origin main*` / `gh pr merge *`）でも多重に保護している。将来 public 化したら GitHub のブランチ保護に置き換える。
