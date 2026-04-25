# Hearing: docs-workflows-refactoring-v2

userResponse: "docs/workflows/ ディレクトリの追加リファクタリング。前回(ADR-010)で4カテゴリ(bugfix/feature/investigation/workflow-harness)に分類済み。さらなる整理・改善を実施する。"

## overview

docs/workflows/ ディレクトリの追加リファクタリングを実施する。ADR-010で確立した4カテゴリ体制(bugfix/feature/investigation/workflow-harness)を維持しつつ、ルート直下に散在する未分類ファイル・ディレクトリを適切なカテゴリに振り分ける。

## intent-analysis

- surfaceRequest: docs/workflows/ 直下に残存する .md ファイル19件、未分類サブディレクトリ7件、重複ディレクトリ9件を整理する
- deepNeed: ADR-010で4カテゴリ分類を導入したが、ルート直下に未整理の成果物が残っており、カテゴリ体制の意義が薄れている。完全な分類を達成してディレクトリ構造の一貫性を確保する

## unclearPoints

- 重複ディレクトリ(ルート側 vs カテゴリ側)の内容差異の有無: 削除前にdiffで確認が必要
- 散在 .md ファイルの一部は複数カテゴリに関連する可能性がある: ファイル名と内容から最適なカテゴリを判定する

## assumptions

- ADR-010で確立した4カテゴリ体制(bugfix/feature/investigation/workflow-harness)は変更しない
- ファイル内容の編集は行わない(移動のみ)
- docs/workflows/ 内の成果物は独立したアーカイブであり、他リポジトリからの相対パス参照は限定的
- 対象はdocs/workflows/ディレクトリのみ。ハーネスコードやその他ディレクトリは変更しない

## implementation-plan

3段階で実施:
- (P1) 重複ディレクトリ9件のルート側を削除(カテゴリ側に同一内容が存在することをdiffで確認後)
- (P2) 未分類サブディレクトリ7件を適切なカテゴリに移動
- (P3) 散在 .md ファイル19件を適切なカテゴリ配下に移動(必要に応じて新規タスクディレクトリを作成)

estimatedScope: large。ファイル移動35件(ディレクトリ16件 + .mdファイル19件)。コード変更なし。

## risks

- 重複ディレクトリのルート側と分類済み側で内容が異なる場合、情報消失の可能性がある。移動前にdiffで確認する
- 他の成果物からの相対パス参照が壊れる可能性がある。ただしdocs/workflows/内は独立した成果物アーカイブのため影響は限定的

## decisions

- D-HR-1: 4カテゴリ体制(bugfix/feature/investigation/workflow-harness)を維持する。新カテゴリは追加しない
- D-HR-2: ファイル内容は編集せず、移動のみ行う
- D-HR-3: 移動前後のファイル数を照合し、データ整合性を保証する

## artifacts

- docs/workflows/docs-workflows-refactoring-v2/hearing.md: 本ヒアリング結果

## next

readFiles: "docs/workflows/"
warnings: "重複ディレクトリ9件は削除前にカテゴリ側との差分確認が必須"
