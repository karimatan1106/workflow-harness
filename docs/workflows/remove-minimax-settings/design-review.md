# Design Review: remove-minimax-settings

## Overview
前段 10 フェーズ（hearing, scope_definition, research, impact_analysis, requirements, threat_modeling, planning, state_machine, flowchart, ui_design）の設計成果物を統合レビューし、実装フェーズへ進む準備が整っていることを確認する。

## Review Checklist
- hearing x requirements: ユーザー意図「MiniMax 残骸の完全除去」が F-001..F-005 に反映済み
- scope_definition x requirements: AC-1..AC-5 は scope 定義と完全一致
- requirements x planning: F-001..F-005 と W-1..W-5 が 1:1 対応
- planning x flowchart: 並列 4 操作 + post grep の手順が両ドキュメントで一致
- threat_model: 高リスクなし、mitigation は全項目で記録済み
- ui_design: ドキュメント削除のみのため N/A は妥当

## Findings
- 整合性: 全フェーズで AC / F-ID のマッピングが一貫しており、トレーサビリティに欠損なし
- 欠落: なし（requiredSections・requiredArtifacts はいずれも充足）
- リスク: 全項目 Low または N/A、追加対策不要
- 冗長: なし（重複記述・デッドセクションなし）

## Traceability Matrix Snapshot
- AC-1 -> F-001 -> W-1
- AC-2 -> F-002 -> W-2
- AC-3 -> F-003 -> W-3
- AC-4 -> F-004 -> W-4
- AC-5 -> F-005 -> W-5

## acDesignMapping

- AC-1: CLAUDE.md の `## workflow-harness/.claude/settings.json 注意事項` セクション全体削除に対応する設計要素は planning.md W-1 と flowchart.mmd の CLAUDE.md 分岐
- AC-2: feedback_no-minimax.md ファイル削除に対応する設計要素は planning.md W-2 と flowchart.mmd の feedback 分岐
- AC-3: MEMORY.md 索引行削除に対応する設計要素は planning.md W-3 と flowchart.mmd の MEMORY.md 分岐
- AC-4: canboluk.md ベンチマーク表内 MiniMax 行削除に対応する設計要素は planning.md W-4 と flowchart.mmd の canboluk.md 分岐
- AC-5: 対象 4 ファイル grep 0 件検証に対応する設計要素は planning.md W-5 と flowchart.mmd の PostGrep ノード

## Decisions
- D-DR-1: 前段 10 フェーズの設計成果物は整合しており、実装フェーズへ進める判断を下す
- D-DR-2: AC-1..AC-5 と F-001..F-005 のトレーサビリティは全フェーズで維持されていることを確認した
- D-DR-3: 並列 4 操作の実装順序に依存はなく、ロールバックは単一 git revert で完結する
- D-DR-4: UI / API 影響は N/A のため、テスト設計は grep と file exists チェックに限定する
- D-DR-5: 全脅威は mitigation 済みまたは N/A のため、セキュリティ追加対策は不要

## Approval Status
- ready for implementation: yes
- blockers: none
- outstanding questions: none

## Artifacts
- design-review.md

## Next
- next: test_design
- input: requirements.md, planning.md, design-review.md
