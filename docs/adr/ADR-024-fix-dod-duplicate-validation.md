# ADR-024: fix-dod-duplicate-validation

Status: accepted
Date: 2026-04-08
TaskId: a2e871af-3495-4917-832d-c5ebaed2180d

## Intent (Why)
DoDバリデーターの7x重複行エラー修正。dod-helpers.tsのcontent_validationロジックで、別セクションの別内容を同一ハイフン行として誤って重複判定している問題の原因特定と修正。問題: decisions(6行)、next(1行)、DoD条件(3行)等が異なるセクションでもハイフン始まり行を横断してカウントし7回以上で重複エラー出している。修正対象: dod-helpers.tsのcontent_validation関数

## Acceptance Criteria (What)
- AC-1: checkDuplicateLines がセクション単位で重複カウントすること [met]
- AC-2: 異なるセクションの同一ハイフン行が横断カウントされないこと [met]
- AC-3: isStructuralLine L27の過剰マッチがDUP-ID形式行に影響しないこと [met]
- AC-4: dod-l4-duplicate.test.ts の4テストが全てパスすること [met]
- AC-5: 既存テストにリグレッションがないこと [met]

## Scope
Files: (none)
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\fix-dod-duplicate-validation
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
