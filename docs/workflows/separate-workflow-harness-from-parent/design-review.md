# Design Review: separate-workflow-harness-from-parent

task: separate-workflow-harness-from-parent
phase: design_review
date: 2026-04-11

## summary

本レビューは、これまでのフェーズ成果物 (scope-definition, requirements,
impact-analysis, threat-model, planning, state-machine, flowchart, ui-design)
を横断的にチェックし、AC と設計要素のマッピングを確定するものである。
全 7 つの AC が planning の Worker タスク、flowchart のノード、state-machine
の状態に 1 対 1 で対応していることを確認した。リスク評価は低位で、rollback
戦略 (git revert) は planning と threat-model の双方で一致している。

## decisions

- D-DR-1: 全 AC (AC-1〜AC-7) が planning の Worker タスク (W-1〜W-7) と
  flowchart のノード (W1〜W7) に 1 対 1 対応している
- D-DR-2: threat-model と impact-analysis の評価は共にリスク低で一致しており、
  追加の緩和策は不要である
- D-DR-3: state-machine と flowchart の実行パスは直列であり、両者の遷移順序
  (CopyADR → CopyPhases → CopyHooks → CopyCommands → CopyRules → FixMcp →
  Commit → Push) が完全一致している
- D-DR-4: ui-design は N/A 判定である。本タスクはファイル移管と設定修正のみで、
  ユーザー対話 UI の変更を含まないため
- D-DR-5: scope-definition / requirements / impact-analysis / planning の
  成果物間で対象ファイル集合と境界条件に食い違いがないことを確認した
- D-DR-6: scope の in-scope (ADR, phases, hooks, commands, rules, .mcp.json)
  と not-in-scope (親の CLAUDE.md, 外部依存パッケージ) の境界が明確に
  分離されている
- D-DR-7: rollback 戦略として git revert を採用する方針が planning の
  リリース戦略と threat-model の回復手順で一致している

## artifacts

- scope-definition.md — 対象範囲と境界条件
- requirements.md — AC-1〜AC-7 定義
- impact-analysis.md — 影響範囲 (低)
- threat-model.md — STRIDE 評価 (低リスク)
- planning.md — Worker タスク W-1〜W-7
- state-machine.mmd — 状態遷移図
- flowchart.mmd — 実行フローチャート
- ui-design.md — N/A 判定記録
- design-review.md — 本ドキュメント

## acDesignMapping

| AC    | 内容                | planning | flowchart | state-machine    |
|-------|---------------------|----------|-----------|------------------|
| AC-1  | ADR 移管            | W-1      | W1 node   | CopyADR          |
| AC-2  | phases 移管         | W-2      | W2 node   | CopyPhases       |
| AC-3  | hooks 移管          | W-3      | W3 node   | CopyHooks        |
| AC-4  | commands 移管       | W-4      | W4 node   | CopyCommands     |
| AC-5  | rules 移管          | W-5      | W5 node   | CopyRules        |
| AC-6  | .mcp.json cwd 修正  | W-6      | W6 node   | FixMcp           |
| AC-7  | commit + push       | W-7      | W7 node   | Commit / Push    |

マッピングエントリ数: 7 (AC-1〜AC-7 の全件カバー)

## consistency check

- AC カバレッジ: 7 / 7 (100%)
- planning → flowchart 対応: 7 / 7
- flowchart → state-machine 対応: 7 / 7
- scope in-scope 項目 → AC 対応: 全項目が AC に紐付き済み
- 禁止語スキャン: clean
- 重複行チェック: clean

## next

- implementation_plan フェーズへ進む
- Worker タスク W-1〜W-7 を並列実行可能性の観点で再検証する
- DoD ゲート (L1-L4) の実行条件を implementation_plan で具体化する
