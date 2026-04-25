# Scope Definition: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28

## User Intent

docs/workflows/ ディレクトリの追加リファクタリング。前回(ADR-010)で4カテゴリ(bugfix/feature/investigation/workflow-harness)に分類済み。さらなる整理・改善を実施する。

## Current State Analysis

### ADR-010 で達成済み

- 4カテゴリディレクトリ作成: bugfix(49件), feature(37件), investigation(34件), workflow-harness(93件)
- 半角カタカナ重複削除
- 旧プロジェクトディレクトリ削除

### 残存する問題

1. ルート直下に散在する .md ファイル: 19件
2. ルート直下に未分類サブディレクトリ: 16件
3. ルートとカテゴリ内に重複ディレクトリ: 9件

## Problem Breakdown

### P1: 重複ディレクトリの排除 (9件)

ルート直下に残るディレクトリが、既にカテゴリ内にも存在する。ルート側を削除する。

| Root Dir | Exists In |
|----------|-----------|
| cli-test | investigation |
| concurrent-n58-0 | feature, investigation |
| concurrent-n58-1 | feature, investigation |
| concurrent-n58-2 | feature, investigation |
| integ-test-n58 | feature, investigation |
| list-test-n58 | investigation |
| persist-test-n58 | investigation |
| scope-test-n58 | investigation |
| test-inv | investigation |

### P2: 未分類サブディレクトリのカテゴリ振り分け (7件)

ルート直下に残る未分類ディレクトリを適切なカテゴリに移動する。

| Dir | Proposed Category | Rationale |
|-----|-------------------|-----------|
| agent-delegation-prompt-templates | feature | プロンプトテンプレート機能の開発タスク |
| article-insights-harness-improvements | workflow-harness | ハーネス改善タスク |
| harness-analytics-improvement | workflow-harness | ハーネス分析機能改善 |
| harness-detailed-error-analytics | workflow-harness | ハーネスエラー分析機能 |
| harness-observability-logging | workflow-harness | ハーネス可観測性ログ機能 |
| prompt-format-hybrid-rule | workflow-harness | プロンプト形式ルール（ハーネス運用） |
| prompt-format-hybrid-v2 | workflow-harness | プロンプト形式v2（ハーネス運用） |

### P3: 散在 .md ファイルのディレクトリ化またはカテゴリ移動 (19件)

ルート直下の .md ファイルはタスク成果物として個別ディレクトリに格納するか、関連タスクディレクトリに統合する。

| File | Action | Target |
|------|--------|--------|
| ai-slop-detection-investigation.md | investigation に移動 | investigation/ai-slop-detection/ |
| ai-slop-p3-impact-analysis.md | 上記と統合 | investigation/ai-slop-detection/ |
| artifact-drift-investigation.md | investigation に移動 | investigation/artifact-drift/ |
| codebase-analysis-for-enhancements.md | investigation に移動 | investigation/codebase-analysis-for-enhancements/ |
| code-reuse-review.md | investigation に移動 | investigation/code-reuse-review/ |
| code-review-delegation-files.md | investigation に移動 | investigation/code-review-delegation-files/ |
| efficiency-review-delegation.md | investigation に移動 | investigation/efficiency-review-delegation/ |
| file-capacity-report.md | investigation に移動 | investigation/file-capacity-report/ |
| file-structure-analysis.md | investigation に移動 | investigation/file-structure-analysis/ |
| p5-retry-pivot-investigation.md | investigation に移動 | investigation/p5-retry-pivot/ |
| p5-retry-pivot-impact-analysis.md | 上記と統合 | investigation/p5-retry-pivot/ |
| p6-ac-min-count-investigation.md | investigation に移動 | investigation/p6-ac-min-count/ |
| p6-ac-min-change-impact-analysis.md | 上記と統合 | investigation/p6-ac-min-count/ |
| planning-code-fence-exclusion-analysis.md | investigation に移動 | investigation/planning-code-fence-exclusion/ |
| planning-nocodefences-impact-analysis.md | 上記と統合 | investigation/planning-code-fence-exclusion/ |
| refactoring.md | workflow-harness に移動 | workflow-harness/code-quality-refactoring/ |
| security-scan-error-toon.md | investigation に移動 | investigation/security-scan-error-toon/ |
| tdd-red-phase-report.md | investigation に移動 | investigation/tdd-red-phase-report/ |
| test-selection-error-analytics.md | investigation に移動 | investigation/test-selection-error-analytics/ |

## Scope Boundary

### In Scope

- docs/workflows/ 直下の .md ファイル 19件の移動・整理
- docs/workflows/ 直下の未分類サブディレクトリ 7件のカテゴリ移動
- docs/workflows/ 直下の重複サブディレクトリ 9件の削除
- 移動先が存在しない場合のディレクトリ作成

### Out of Scope

- カテゴリディレクトリ内部の再構成（bugfix/feature/investigation/workflow-harness 内の整理）
- ファイル内容の編集・書き換え
- 新規カテゴリの追加（4カテゴリ体制は維持）
- ハーネスコードの変更

## Acceptance Criteria

- AC-1: docs/workflows/ 直下に .md ファイルが存在しないこと
- AC-2: docs/workflows/ 直下にカテゴリディレクトリ(bugfix/feature/investigation/workflow-harness)以外のタスクディレクトリが存在しないこと（自身の docs-workflows-refactoring-v2 は除く）
- AC-3: 重複ディレクトリ9件のルート側が削除されていること
- AC-4: 未分類サブディレクトリ7件が適切なカテゴリに移動されていること
- AC-5: 散在 .md ファイル19件が適切なカテゴリ配下に移動されていること
- AC-6: 移動によるファイル消失がないこと（移動前後のファイル数が一致）

## Risk Assessment

- Risk-1: 重複ディレクトリのルート側と分類済み側で内容が異なる可能性 -> 移動前にdiffで確認
- Risk-2: 他の成果物からの相対パス参照が壊れる可能性 -> 影響は限定的（docs/workflows/内は独立した成果物アーカイブ）

## decisions

- D-001: 4カテゴリ体制(bugfix/feature/investigation/workflow-harness)を維持する (ADR-010で確立済み、変更理由がないため)
- D-002: 重複ディレクトリはルート側を削除する (カテゴリ側が正として機能しているため)
- D-003: 未分類サブディレクトリはコンテンツに基づきカテゴリに振り分ける (手動分類、自動化不要)
- D-004: 散在.mdファイルは関連性に基づきディレクトリ化して移動する (同一調査の複数ファイルは統合ディレクトリに格納)
- D-005: ファイル内容の編集は行わず移動のみとする (スコープ限定、副作用防止)

## artifacts

- scope-definition.md: スコープ定義書（本ファイル）

## next

- research フェーズで重複ディレクトリの内容差分を確認する

## RTM

- F-001: AC-1 (散在mdファイル排除)
- F-002: AC-2, AC-3, AC-4 (ディレクトリ整理)
- F-003: AC-5 (mdファイルカテゴリ分類)
- F-004: AC-6 (データ整合性)
