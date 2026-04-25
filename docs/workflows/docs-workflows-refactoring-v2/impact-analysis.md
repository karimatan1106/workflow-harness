# Impact Analysis: docs-workflows-refactoring-v2

phase: impact_analysis
task: docs-workflows-refactoring-v2
status: complete
summary: docs/workflows/ 配下のファイル移動・空ディレクトリ削除のみで構成される低リスクリファクタリング。コード変更・API変更・設定変更は一切なく、影響範囲はドキュメントアーカイブ内に限定される。

## impactedFiles[48]{file,changeType,risk}

### P1: Empty duplicate root dirs - delete (9 files)

- docs/workflows/cli-test/, delete, 低 (empty dir)
- docs/workflows/concurrent-n58-0/, delete, 低 (empty dir)
- docs/workflows/concurrent-n58-1/, delete, 低 (empty dir)
- docs/workflows/concurrent-n58-2/, delete, 低 (empty dir)
- docs/workflows/integ-test-n58/, delete, 低 (empty dir)
- docs/workflows/list-test-n58/, delete, 低 (empty dir)
- docs/workflows/persist-test-n58/, delete, 低 (empty dir)
- docs/workflows/scope-test-n58/, delete, 低 (empty dir)
- docs/workflows/test-inv/, delete, 低 (empty dir)

### P1-cleanup: Empty category-side dirs - delete (13 dirs)

- docs/workflows/investigation/cli-test/cli-test/, delete, 低 (empty nested dir)
- docs/workflows/investigation/list-test-n58/list-test-n58/, delete, 低 (empty nested dir)
- docs/workflows/investigation/persist-test-n58/persist-test-n58/, delete, 低 (empty nested dir)
- docs/workflows/investigation/scope-test-n58/scope-test-n58/, delete, 低 (empty nested dir)
- docs/workflows/investigation/test-inv/test-inv/, delete, 低 (empty nested dir)
- docs/workflows/feature/concurrent-n58-0/, delete, 低 (empty dir)
- docs/workflows/feature/concurrent-n58-1/, delete, 低 (empty dir)
- docs/workflows/feature/concurrent-n58-2/, delete, 低 (empty dir)
- docs/workflows/feature/integ-test-n58/, delete, 低 (empty dir)
- docs/workflows/investigation/concurrent-n58-0/, delete, 低 (empty dir)
- docs/workflows/investigation/concurrent-n58-1/, delete, 低 (empty dir)
- docs/workflows/investigation/concurrent-n58-2/, delete, 低 (empty dir)
- docs/workflows/investigation/integ-test-n58/, delete, 低 (empty dir)

### P2: Uncategorized dirs - move (7 dirs)

- docs/workflows/agent-delegation-prompt-templates/, move to feature/, 低
- docs/workflows/article-insights-harness-improvements/, move to workflow-harness/, 低
- docs/workflows/harness-analytics-improvement/, move to workflow-harness/, 低
- docs/workflows/harness-detailed-error-analytics/, move to workflow-harness/, 低
- docs/workflows/harness-observability-logging/, move to workflow-harness/, 低
- docs/workflows/prompt-format-hybrid-rule/, move to workflow-harness/, 低
- docs/workflows/prompt-format-hybrid-v2/, move to workflow-harness/, 低

### P3: Loose .md files - move (19 files)

- docs/workflows/ai-slop-detection-investigation.md, move to investigation/ai-slop-detection/, 低
- docs/workflows/ai-slop-p3-impact-analysis.md, move to investigation/ai-slop-detection/, 低
- docs/workflows/artifact-drift-investigation.md, move to investigation/artifact-drift/, 低
- docs/workflows/codebase-analysis-for-enhancements.md, move to investigation/codebase-analysis-for-enhancements/, 低
- docs/workflows/code-reuse-review.md, move to investigation/code-reuse-review/, 低
- docs/workflows/code-review-delegation-files.md, move to investigation/code-review-delegation-files/, 低
- docs/workflows/efficiency-review-delegation.md, move to investigation/efficiency-review-delegation/, 低
- docs/workflows/file-capacity-report.md, move to investigation/file-capacity-report/, 低
- docs/workflows/file-structure-analysis.md, move to investigation/file-structure-analysis/, 低
- docs/workflows/p5-retry-pivot-investigation.md, move to investigation/p5-retry-pivot/, 低
- docs/workflows/p5-retry-pivot-impact-analysis.md, move to investigation/p5-retry-pivot/, 低
- docs/workflows/p6-ac-min-count-investigation.md, move to investigation/p6-ac-min-count/, 低
- docs/workflows/p6-ac-min-change-impact-analysis.md, move to investigation/p6-ac-min-count/, 低
- docs/workflows/planning-code-fence-exclusion-analysis.md, move to investigation/planning-code-fence-exclusion/, 低
- docs/workflows/planning-nocodefences-impact-analysis.md, move to investigation/planning-code-fence-exclusion/, 低
- docs/workflows/refactoring.md, move to workflow-harness/code-quality-refactoring/, 低
- docs/workflows/security-scan-error-toon.md, move to investigation/security-scan-error-toon/, 低
- docs/workflows/tdd-red-phase-report.md, move to investigation/tdd-red-phase-report/, 低
- docs/workflows/test-selection-error-analytics.md, move to investigation/test-selection-error-analytics/, 低

## unaffectedModules[6]{module,reason}

- workflow-harness/mcp-server/, ドキュメント移動のみでハーネスのソースコードに変更なし
- workflow-harness/hooks/, フック定義に docs/workflows/ パスへの参照なし
- .claude/rules/, ルールファイルは docs/workflows/ 内のパスを参照していない
- .claude/skills/, スキルファイルは docs/workflows/ 内の個別パスを参照していない
- docs/adr/, ADRはイミュータブルで変更対象外
- src/ (親リポジトリ), ソースコードは docs/workflows/ のパスに依存していない

## Cross-Reference Analysis

docs/workflows/ 内のパスを参照しているファイルを検索した結果:

- workflow-harness 内部状態ファイル (workflow-state.toon): ハーネスの docsDir フィールドにパスが記録されているが、これらは過去タスクの完了済み状態記録であり、実行時に参照されない。影響なし。
- workflow-harness テストファイル (outlier-detection.test.ts, error-classification.test.ts): テストデータとしてタスク名が含まれるが、実際のファイルパスを参照しているわけではない。影響なし。
- .agent/edit-auth.txt, .agent/state-machine-result.toon: 一時ファイルであり、セッション跨ぎで参照されない。影響なし。

## breakingChanges

なし。本リファクタリングはドキュメントアーカイブの整理のみで、コード変更・API変更・設定変更を含まない。git mv によりファイル内容は完全に保存される。

## Git History Impact

git mv を使用するためファイルの移動履歴は保持される。git log --follow で移動前の履歴も追跡可能。

## decisions

- IA-01, 全48操作のリスクレベルは「低」と判定, 全操作がドキュメントの移動または空ディレクトリ削除であり、コード・設定・APIへの影響が皆無のため
- IA-02, ハーネス内部状態ファイルの docsDir パス更新は不要, 過去タスクの完了済み記録であり実行時に再参照されないため
- IA-03, git mv による移動を採用し手動コピー+削除は行わない, git履歴の追跡性を維持するため
- IA-04, P1の空ディレクトリ削除とP1-cleanupのカテゴリ側空ディレクトリ削除を同時に実施する, 空ディレクトリを残すと次回の整理作業で再度対応が必要になるため
- IA-05, 移動前後のファイル数カウントで整合性を検証する, AC-6(データ整合性)の検証手段として確実性が高いため

## artifacts

- docs/workflows/docs-workflows-refactoring-v2/impact-analysis.md, report, 影響分析結果(48操作の影響評価と相互参照分析)

## next

- criticalDecisions: 全操作が低リスク。破壊的変更なし。外部参照の影響なし。
- readFiles: scope-definition.md (AC定義), research.md (ベースラインメトリクス)
- warnings: P1-cleanupの13空ディレクトリはresearchフェーズで追加発見された項目。planningフェーズで操作順序に注意(親ディレクトリ削除前に子を削除)。
