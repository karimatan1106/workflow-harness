# Design Review: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Review Summary

3つのagent定義ファイル(coordinator.md, worker.md, hearing-worker.md)に品質ルールセクションを追記する設計を精査した。設計成果物は state-machine.mmd, flowchart.mmd, ui-design.md, planning.md, impact-analysis.md の5点。全成果物に対して AC-設計マッピング、リスク評価、整合性確認を実施した。

## AC-Design Mapping

| AC | Requirements (F-NNN) | Design Artifact | Coverage |
|----|----------------------|-----------------|----------|
| AC-1 | F-001 | planning.md Step 1, state-machine.mmd CoordinatorEdited, flowchart.mmd EDIT_COORD | Complete |
| AC-2 | F-002 | planning.md Step 2, state-machine.mmd WorkerEdited, flowchart.mmd EDIT_WORKER | Complete |
| AC-3 | F-003 | planning.md Step 3, state-machine.mmd HearingWorkerEdited, flowchart.mmd EDIT_HEARING | Complete |
| AC-4 | F-001, F-002 | planning.md Step 4, flowchart.mmd RUN_TESTS | Complete (7 tests) |
| AC-5 | F-003 | planning.md Step 4, flowchart.mmd RUN_TESTS | Complete (3 tests) |

## Design Artifact Review

### state-machine.mmd

正確に3つの並列編集パスと統合テスト実行を表現している。失敗時のFixRegex経由の再編集ループも含まれる。状態遷移はPreEdit -> EditPhase -> TestExecution -> AllPass の4段階で、各ファイルの独立性が並列状態で表現されている。

### flowchart.mmd

テストスイートの分類から各ファイルの編集、200行制限チェック、テスト実行、既存テスト影響確認までの全工程を網羅している。LINE_CHECK ノードで各ファイルの追加後行数(42行, 60行, 31行)を具体的に記載しており、200行制限の遵守が設計段階で確認済み。

### ui-design.md

本タスクにUI変更が含まれないことを明確に記録している。影響分析7項目(画面レイアウト, ユーザー操作フロー, 入力フォーム, 出力表示, エラーメッセージ, アクセシビリティ, レスポンシブ)全て「変更なし」と判定。適切な判断。

### planning.md

4ステップの実装計画が具体的で、追加するテキスト内容まで記載されている。テスト正規表現パターンとの照合が明示されており、テスト駆動の方針が一貫している。

### impact-analysis.md

影響マトリクスで行数変化を定量的に記録。Direct/Indirect/No Impact の3段階で波及範囲を分類。既存6件PASSテストへの影響なしを確認済み。

## Consistency Check

- scope-definition.md の S-1/S-2/S-3 と planning.md の Step 1/2/3 が1対1で対応している
- requirements.md の F-001/F-002/F-003 と planning.md の追加内容が正規表現パターンレベルで一致している
- state-machine.mmd の並列パスと flowchart.mmd のファイル分岐が同一構造を表現している
- 全成果物で「テストコード変更なし」「既存セクション変更なし」「末尾追記のみ」の方針が一貫している

## Risk Evaluation

- Markdownテキスト追記のみでコード実行パスに影響なし: Low
- 200行制限: 最大65行(worker.md)で十分な余裕あり: Low
- 正規表現パターン不一致リスク: planning.md に具体的なテキストが記載済みで軽減: Low
- 既存テストへの影響: 追記のみで既存セクション非改変、影響なし: Low

## decisions

- D-001: 設計成果物5点全てがAC-1〜AC-5の要件をカバーしていることを確認した
- D-002: state-machine.mmd と flowchart.mmd の間に構造的矛盾がないことを確認した
- D-003: planning.md の追加テキスト内容がテスト正規表現パターン(research.md記載)に合致することを確認した
- D-004: UI変更が不在であるため ui-design.md の「変更なし」判定は適切と判断した
- D-005: 3ファイルの変更が相互独立であり並列実装可能な設計は妥当と判断した
- D-006: 200行制限に対して最大65行と十分な余裕があり、制限超過リスクはないと判断した
- D-007: 既存セクション非改変方針により既存PASSテストへの回帰リスクはないと判断した

## artifacts

- `docs/workflows/fix-failing-quality-rule-tests/design-review.md` (本ファイル)
- `docs/workflows/fix-failing-quality-rule-tests/state-machine.mmd` (レビュー結果: state-machine.mmd 承認)
- `docs/workflows/fix-failing-quality-rule-tests/flowchart.mmd` (レビュー結果: flowchart.mmd 承認)
- `docs/workflows/fix-failing-quality-rule-tests/ui-design.md` (レビュー結果: ui-design.md 承認)
- `docs/workflows/fix-failing-quality-rule-tests/planning.md` (レビュー結果: planning.md 承認)
- `docs/workflows/fix-failing-quality-rule-tests/impact-analysis.md` (レビュー結果: 全体設計整合性 承認)

## acDesignMapping
- AC-1: coordinator.md Phase Output Rules → state-machine.mmd EditCoordinator状態
- AC-2: worker.md Edit Completeness → state-machine.mmd EditWorker状態
- AC-3: hearing-worker.md Quality Rules → state-machine.mmd EditHearingWorker状態
- AC-4: first-pass-improvement.test.ts全PASS → flowchart.mmd テスト実行フロー
- AC-5: hearing-worker-rules.test.ts全PASS → flowchart.mmd テスト実行フロー

## next

implementation フェーズへ進む。planning.md の Step 1-3 に従い3ファイルへのセクション追記を実行し、Step 4 で全10テストPASSを確認する。
