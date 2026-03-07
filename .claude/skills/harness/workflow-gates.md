---
name: harness-gates
description: Control levels (L1-L4), DoD gate checks by phase, and user intent policy (UI-1~7).
---
> CLAUDE.md Sec7(IA-1~7)/Sec10(Traceability) が権威仕様。本ファイルはDoD詳細とUI政策のみ。

## 1. Control Levels (L1-L4)

| Level | Type | Reliability | Example |
|-------|------|-------------|---------|
| L1 | File existence | 100% | `fs.existsSync(artifact)`, SHA-256 compare |
| L2 | Exit code | 100% | `npm run build` exit 0, `tsc --noEmit` exit 0 |
| L3 | Numeric threshold | 100% | lines >= 50, density >= 30%, AC count >= 3 |
| L4 | Regex/pattern | 95%+ | Required sections, forbidden words, F-NNN format |
| L5 | LLM judgment | 70-90% | **BANNED in gates.** Advisory only. |

**Why L5 is banned (PSC-5)**: Improvability = verifiability. L5 is non-deterministic, unverifiable, therefore unimprovable.

## 2. DoD Gate Checks by Phase

**Common checks (every phase)**:
- Before start: L1 previous artifacts exist, L1 approved artifacts SHA-256 unchanged, L3 scope files <= 100
- Before end: L1 output artifact exists, L3 minLines met, L4 no forbidden patterns, L4 no `[#xxx#]`, L4 no 3+ duplicate lines

| Phase | L1 | L2 | L3 | L4 |
|-------|----|----|----|----|
| scope_definition | file exists | - | files <= 100 | entry_points non-empty |
| research | file exists | - | >= 30 lines | `## サマリー`, `## ユーザー意図の分析` |
| impact_analysis | file exists | - | >= 20 lines | required fields |
| requirements | file exists | - | AC >= 3, >= 40 lines | OPEN_QUESTIONS empty, NOT_IN_SCOPE |
| threat_modeling | file exists | - | >= 30 lines | required sections |
| planning | file exists | - | >= 40 lines | F-NNN with spec |
| state_machine / flowchart | file exists | - | >= 15 lines | valid stateDiagram-v2 / flowchart |
| ui_design | file exists | - | >= 30 lines | required sections |
| test_design | file exists | - | >= 40 lines | AC-to-TC coverage |
| test_selection | file exists | - | >= 15 lines | test lists present |
| test_impl | test files | tests executed | >= 1 FAILS | - |
| implementation | source files | tsc exit 0 | all tests GREEN | no out-of-scope edits |
| refactoring | - | tests pass, tsc exit 0 | - | /simplify executed (SMP-1) |
| build_check | - | build/tsc/eslint/madge exit 0 | - | - |
| code_review | file exists | - | >= 30 lines | AC table zero failures |
| testing | - | all tests exit 0 | - | baseline captured |
| regression_test | - | tests executed | new failures = 0 | - |
| acceptance_verification | file exists | - | >= 20 lines | all ACs met, RTM verified |
| verification phases | files exist | - | >= 30 lines | required sections |
| health_observation | file exists | - | >= 15 lines | metrics within thresholds |

## 3. User Intent Policy (UI-1 through UI-7)

- **UI-1**: userIntent < 20 chars → block at `harness_start` (PF-3)
- **UI-2**: Detect vague expressions (とか, など, いい感じ, 適当に, よしなに) → request rephrasing (PF-4)
- **UI-3**: Before `harness_approve("requirements")`: verify NFRs are quantitatively defined
- **UI-4**: Post-approval additions → `harness_record_feedback` → ask user to return to requirements or create new task
- **UI-5**: code_review intent alignment: userIntent keywords in implementation, NOT_IN_SCOPE items not implemented
- **UI-6**: `harness_record_feedback` should structure as Q&A pairs (Sprint 3)
- **UI-7**: At `harness_start`: verb + noun but no "why"/"to what degree" → warning (PF-5)

## 4. Orchestrator Direct Edit Policy

Orchestratorが `docs/workflows/` 配下のファイルをWrite/Editで直接編集することは禁止。
バリデーション失敗時はTask toolでサブエージェントを再起動すること。
例外: `claude-progress.txt` のみOrchestratorが直接更新可能。
