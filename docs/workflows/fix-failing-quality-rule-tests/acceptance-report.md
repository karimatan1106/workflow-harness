# Acceptance Report: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925
phase: acceptance_verification
date: 2026-04-08

## Summary

coordinator.md, worker.md, hearing-worker.md の3ファイルに品質ルールセクションを追加し、テスト失敗10件を全て解消した。全864テストがPASSし、AC-1〜AC-5を全て充足。

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | coordinator.md に Phase Output Rules セクション追加、TC-AC1-01〜04 全PASS | met | commit 89a84eb, 4テストPASS確認 |
| AC-2 | worker.md に Edit Completeness セクション追加、TC-AC2-01〜03 全PASS | met | commit 89a84eb, 3テストPASS確認 |
| AC-3 | hearing-worker.md に AskUserQuestion Quality Rules セクション追加、3テスト全PASS | met | commit 89a84eb, 3テストPASS確認 |
| AC-4 | first-pass-improvement.test.ts の7件失敗テスト全PASS | met | 854/864 → 864/864 (7件改善) |
| AC-5 | hearing-worker-rules.test.ts の3件失敗テスト全PASS | met | 854/864 → 864/864 (3件改善) |

## RTM Verification

| RTM ID | Requirement | AC | Status |
|--------|-------------|-----|--------|
| F-001 | coordinator.md Phase Output Rules 追加 | AC-1, AC-4 | verified |
| F-002 | worker.md Edit Completeness 追加 | AC-2, AC-4 | verified |
| F-003 | hearing-worker.md AskUserQuestion Quality Rules 追加 | AC-3, AC-5 | verified |
| F-004 | first-pass-improvement.test.ts 全7件PASS | AC-4 | verified |
| F-005 | hearing-worker-rules.test.ts 全3件PASS | AC-5 | verified |

## Test Results

- Before: 854/864 PASS (10 failures)
- After: 864/864 PASS (0 failures)
- Delta: +10 tests fixed
- Regression: none detected

## decisions

- D-001: テスト駆動アプローチを採用し、テストの正規表現パターンに文言を合致させた。テストが正であり実装側を合わせる方針で一貫性を確保。
- D-002: 既存セクションの内容は一切変更せず追記のみとした。既存テストへのregression riskを排除。
- D-003: 各ファイル200行制限を維持。追加内容は必要最小限に留め、coordinator.md / worker.md / hearing-worker.md 全て制限内。
- D-004: coordinator.md の Phase Output Rules は Role/Context セクションの後に配置。worker.md の Edit Completeness は Edit Modes セクションの後に配置。hearing-worker.md の AskUserQuestion Quality Rules は AskUserQuestion Guidelines の後に配置。各ファイルの論理的な構成順序を維持。
- D-005: テストコード自体には変更を加えない方針を最後まで維持。agentファイル側の品質ルール不足が根本原因であり、テスト修正は不適切と判断。
- D-006: 3ファイルを単一コミット(89a84eb)で一括変更。変更の原子性を確保し、bisect時の追跡容易性を維持。
- D-007: defs-stage4.ts および200行制限テスト(TC-AC3-01, TC-AC3-02, TC-AC4-01〜03)は既にPASSのためスコープ外とした。不要な変更を避けた。

## artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| coordinator.md | .claude/agents/coordinator.md | Phase Output Rules セクション追加済み |
| worker.md | .claude/agents/worker.md | Edit Completeness セクション追加済み |
| hearing-worker.md | .claude/agents/hearing-worker.md | AskUserQuestion Quality Rules セクション追加済み |
| commit | 89a84eb | fix: add quality rules to hearing-worker.md, coordinator.md, worker.md |

## next

done — 全AC met、全テストPASS、RTM全verified。タスク完了。
