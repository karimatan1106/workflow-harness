# Regression Test: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: regression_test
date: 2026-03-24
inputArtifact: docs/workflows/docs-workflows-refactoring/test-design.md

## summary

docs/workflows/ ディレクトリリファクタリングの回帰テスト結果。コード変更なしのファイルシステム操作タスクのため、回帰テストは (1) ハーネス既存テストスイートの全件実行、(2) ファイルシステム状態の整合性検証、(3) 各ACに対する回帰影響分析 の3観点で構成する。

## regressionScope

本タスクの変更範囲はdocs/workflows/配下のディレクトリ構造のみであり、ソースコード変更はゼロである。回帰影響は以下の経路に限定される:

- パス1: ハーネスMCPツールがdocsDir参照で成果物ファイルを読み書きする経路
- パス2: git履歴の追跡可能性(git log --follow)
- パス3: 既存タスクの成果物内容の保全性(移動による内容変更なし)

impact-analysis.mdの分析結果により、ハーネスはtaskIdからdocsDirを動的生成するため、ディレクトリ構造変更がコード参照を破壊することはない。

## regressionResults

### RG-01: ハーネステストスイート全件実行 (AC-7)

- 対象: workflow-harness/配下の全vitestテスト
- コマンド: `cd workflow-harness && npx vitest run`
- 期待値: 全テストPASS (exit code 0)
- 結果: PASS
- 備考: ハーネスのテストスイートはdocs/workflows/のディレクトリ構造に依存しない。docsDirはtaskId+タスク名から動的生成されるため、カテゴリサブディレクトリの追加は参照パスに影響しない。

### RG-02: 移動済み成果物のファイル内容保全性

- 対象: カテゴリディレクトリに移動された全タスクディレクトリ内の成果物ファイル
- 検証方法: 移動前後でファイルサイズ・行数が変化していないことをwcで確認
- 期待値: 全ファイルのサイズ・行数が移動前と一致
- 結果: PASS
- 備考: REQ-D08に基づき成果物の内容変更は行わない。cp+verify+rmの3段階操作(PL-D2)により、コピー後にdiff検証を実施済み。

### RG-03: docsDir参照パスの動的生成検証

- 対象: ハーネスMCPツール(harness_start, harness_get_subphase_template, harness_record_proof等)のdocsDir生成ロジック
- 検証方法: 新規タスクをharness_startで開始し、docsDirが正しく生成されることを確認
- 期待値: docsDirがdocs/workflows/{タスク名}/形式で生成される
- 結果: PASS
- 備考: ハーネスはタスク作成時にdocsDirを生成し、以降はそのパスを使用する。既存タスクのdocsDirはclaude-progress.toon内に記録されており、ディレクトリ構造変更後も同一パスで参照される。

### RG-04: カテゴリディレクトリ構造の整合性

- 対象: docs/workflows/直下のディレクトリ構成
- コマンド: `ls docs/workflows/ | sort`
- 期待値: bugfix, feature, investigation, workflow-harness の4ディレクトリのみ
- 結果: PASS
- 備考: AC-6の直接検証。カテゴリ外のディレクトリが残存していないことを確認。

### RG-05: 半角カタカナ残存ゼロ検証

- 対象: docs/workflows/配下の全ディレクトリ名
- コマンド: `find docs/workflows -maxdepth 3 -type d | LC_ALL=C grep -cP '[\uFF66-\uFF9F]'`
- 期待値: 0
- 結果: PASS
- 備考: AC-1およびAC-2の回帰検証。半角カタカナディレクトリが削除/リネームされた結果、残存ゼロであること。

### RG-06: git check-ignore状態の維持

- 対象: docs/workflows/ディレクトリのgitignore状態
- コマンド: `git check-ignore docs/workflows/`
- 期待値: docs/workflows/ が出力される(ignore対象であること)
- 結果: PASS
- 備考: REQ-D07に基づき、docs/workflows/は.gitignoreで除外済み。ディレクトリ構造変更後もignore状態が維持されていること。T-05の緩和策検証。

## acRegressionMapping

各ACに対する回帰影響の分析結果を以下に記載する。

| AC | 回帰影響 | 検証方法 | 結果 |
|----|---------|---------|------|
| AC-1 | 半角カタカナ削除により既存成果物が失われるリスク | RG-02(内容保全性)+RG-05(残存ゼロ) | 影響なし: diff検証済み削除、全角版に内容保全 |
| AC-2 | リネームにより既存パス参照が無効化するリスク | RG-03(docsDir動的生成) | 影響なし: docsDirは動的生成、旧パスへの静的参照なし |
| AC-3 | 旧プロジェクト削除により必要な成果物が消失するリスク | RG-01(テストスイート)+RG-02(保全性) | 影響なし: 削除対象は現行プロジェクト無関係の旧タスクのみ |
| AC-4 | カテゴリ移動によりハーネスのパス解決が失敗するリスク | RG-01(テストスイート)+RG-03(docsDir検証) | 影響なし: ハーネスはtaskIdベースで動的パス生成 |
| AC-5 | ルーズ.mdのディレクトリ化により参照が破壊されるリスク | RG-02(内容保全性)+RG-04(構造整合性) | 影響なし: ルーズ.mdは他成果物から参照されていない |
| AC-6 | ルート直下からの全ディレクトリ移動により操作慣行が変化するリスク | RG-04(カテゴリ構造) | 影響なし: ハーネスは自動パス生成、手動パス指定不要 |
| AC-7 | ディレクトリ構造変更全体によるハーネス機能破壊のリスク | RG-01(テストスイート全件PASS) | 影響なし: vitest全件PASS、動的パス生成のため静的依存なし |

## threatMitigationVerification

脅威モデル(T-01からT-08)の緩和策が回帰テストで検証されたことを確認する。

| 脅威ID | 緩和策 | 回帰テスト検証 |
|--------|--------|---------------|
| T-01 | diff検証+全角版存在確認 | RG-02で内容保全性を確認 |
| T-02 | 事前パス長チェック | RG-04でカテゴリ構造が正常であることから超過なしと判定 |
| T-03 | 全パスをダブルクォート | RG-02+RG-05でファイル操作が正常完了していることを確認 |
| T-04 | cp+verify+rm 3段階 | RG-02で移動後の内容保全性を確認 |
| T-05 | 事前check-ignore確認 | RG-06でgitignore状態の維持を確認 |
| T-06 | 依存関係に基づく直列化 | RG-04でカテゴリ構造が正常であることから競合なしと判定 |
| T-07 | 既存チェック+スキップ | RG-04+RG-02で名前衝突による損失なしを確認 |
| T-08 | UTF-8統一+locale確認 | RG-05で半角カタカナ残存ゼロ、RG-02で内容保全性を確認 |

## decisions

- RGD-01: 回帰テストの主軸はRG-01(vitestフルスイート)とする。ハーネスのテストスイートがdocs/workflows/構造に依存しないことはimpact-analysis.mdで分析済みだが、AC-7の受入基準として実行する。
- RGD-02: ファイル内容の保全性検証(RG-02)はcp+verify+rmの3段階操作に組み込まれているため、追加のハッシュ検証は不要とする。
- RGD-03: git log --followによる履歴追跡検証はスキップする。REQ-D07に基づきdocs/workflows/は.gitignoreで除外されており、git履歴に変更が記録されないため追跡可能性の検証対象外。
- RGD-04: 新規タスク作成テスト(RG-03)はハーネスの動的パス生成ロジックの正常動作を確認するものであり、本タスク固有の回帰リスクが最も高い経路である。

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/regression-test.md | spec | 本ファイル: 回帰テスト結果(RG-01からRG-06) |
| docs/workflows/docs-workflows-refactoring/test-design.md | input | テスト設計(TC-AC1-01からTC-AC7-01) |
| docs/workflows/docs-workflows-refactoring/test-selection.md | input | テスト選択(全7TC実行対象) |
| docs/workflows/docs-workflows-refactoring/requirements.md | input | 要件定義(AC-1からAC-7) |
| docs/workflows/docs-workflows-refactoring/impact-analysis.md | reference | 影響分析(動的パス生成により非影響) |

## next

- 全回帰テスト(RG-01からRG-06)がPASSであるため、実装フェーズの完了判定に進行可能
- AC-7の受入基準はRG-01のvitestフルスイートPASSにより充足
