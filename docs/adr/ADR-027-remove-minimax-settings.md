# ADR-027: remove-minimax-settings

Status: accepted
Date: 2026-04-11
TaskId: 56415374-a8fe-4d21-b2fe-ed9d9c7a0116

## Intent (Why)
ミニマックス（MiniMax）モデルに関連するすべての設定・参照を削除する。settings.json の env 設定、フックスクリプト、CLAUDE.md の関連記述、feedback ルール等、リポジトリ全体から MiniMax 関連の設定・コメント・参照を網羅的に除去する。

## Acceptance Criteria (What)
- AC-1: CLAUDE.md から `## workflow-harness/.claude/settings.json 注意事項` セクションの見出しと本文が完全に削除されている [met]
- AC-2: ~/.claude/projects/C------Workflow/memory/feedback/feedback_no-minimax.md ファイルが存在しない [met]
- AC-3: ~/.claude/projects/C------Workflow/memory/MEMORY.md に feedback_no-minimax.md の索引行が存在しない [met]
- AC-4: ~/.claude/projects/C------Workflow/memory/patterns/canboluk.md のベンチマーク表から MiniMax 行が削除されている [met]
- AC-5: 対象 4 ファイルに対し `(?i)minimax|m2\.7|ミニマックス` grep が 0 件（workflow-state.toon 自己参照および git 履歴を除く） [met]

## Scope
Files: (none)
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\remove-minimax-settings
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
