# ADR-007: smallタスクDoD最適化(FB#2-#8)

Status: accepted
Date: 2026-03-21
TaskId: 2b0a25ad-8c4c-433f-9d19-8bf998f4fed9

## Intent (Why)
小タスクのワークフロー体験を改善する6件のフィードバック修正: #2 subagentがTOON形式ではなくMarkdownヘッダーで成果物を書く問題、#3 smallタスクのフェーズ数が多すぎる、#4 TDD Redフェーズで実装済み変更のテストが矛盾する、#5 decisions最低5件が小タスクに厳しすぎる、#7 smallタスクのrequirements自動承認、#8 research phaseのminLinesが高すぎる

## Acceptance Criteria (What)
- AC-1: SIZE_SKIP_MAP.small が research と planning をスキップする(FB#3) [open]
- AC-2: decisions最低件数がsmallタスクで3件に緩和される(FB#5) [open]
- AC-3: TDD Red チェックがsmallタスクで免除される(FB#4) [open]
- AC-4: smallタスクのrequirementsゲートが自動承認される(FB#7) [open]
- AC-5: smallタスクのresearch minLinesが減少する(FB#8) [open]
- AC-6: subagentテンプレートでTOON形式の禁止リスト(##ヘッダー等)が明示される(FB#2) [open]

## Scope
Files: (none)
Dirs: (none)

## Artifacts
docsDir: docs\workflows\smallタスクDoD最適化(FB#2-#8)
Completed phases: scope_definition → research → requirements → planning → test_design → test_impl → implementation → build_check → testing → commit → push

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
