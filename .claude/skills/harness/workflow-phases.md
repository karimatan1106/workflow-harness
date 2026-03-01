---
name: harness-phases
description: 30 phases across 8 stages with work descriptions, DoD checks, task sizing, and parallel group dependencies.
---

# Workflow Harness — Phases

## 1. Phase Table (30 Phases, 8 Stages)

| # | Phase | Stage | Model | Parallel | Gate | Bash |
|---|-------|-------|-------|----------|------|------|
| 1 | scope_definition | 0 SCOPE | sonnet | - | - | readonly |
| 2 | research | 1 DISCOVER | sonnet | - | - | readonly |
| 3 | impact_analysis | 1 DISCOVER | sonnet | - | - | readonly |
| 4 | requirements | 2 SPECIFY | sonnet | - | requirements | readonly |
| 5 | threat_modeling | 2 SPECIFY | sonnet | parallel_analysis | - | readonly |
| 6 | planning | 2 SPECIFY | sonnet | parallel_analysis | - | readonly |
| 7 | state_machine | 3 DESIGN | haiku | parallel_design | - | readonly |
| 8 | flowchart | 3 DESIGN | haiku | parallel_design | - | readonly |
| 9 | ui_design | 3 DESIGN | sonnet | parallel_design | - | readonly |
| 10 | design_review | 3 DESIGN | sonnet | - | design | readonly |
| 11 | test_design | 4 TEST | sonnet | - | test_design | readonly |
| 12 | test_selection | 4 TEST | haiku | - | - | readonly |
| 13 | test_impl | 4 TEST | sonnet | - | - | readonly, testing |
| 14 | implementation | 5 IMPL | sonnet | - | - | readonly, testing, impl |
| 15 | refactoring | 5 IMPL | haiku | - | - | readonly, testing, impl |
| 16 | build_check | 6 QUALITY | haiku | parallel_quality | - | readonly, testing, impl |
| 17 | code_review | 6 QUALITY | **opus** | parallel_quality | code_review | readonly |
| 18 | testing | 6 QUALITY | haiku | - | - | readonly, testing |
| 19 | regression_test | 6 QUALITY | haiku | - | - | readonly, testing |
| 20 | acceptance_verification | 6 QUALITY | sonnet | - | acceptance | readonly |
| 21 | manual_test | 7 SHIP | sonnet | parallel_verif | - | readonly, testing |
| 22 | security_scan | 7 SHIP | sonnet | parallel_verif | - | readonly, testing |
| 23 | performance_test | 7 SHIP | sonnet | parallel_verif | - | readonly, testing |
| 24 | e2e_test | 7 SHIP | sonnet | parallel_verif | - | readonly, testing |
| 25 | docs_update | 7 SHIP | haiku | - | - | readonly |
| 26 | commit | 7 SHIP | haiku | - | - | readonly, git |
| 27 | push | 7 SHIP | haiku | - | - | readonly, git |
| 28 | ci_verification | 7 SHIP | haiku | - | - | readonly |
| 29 | deploy | 7 SHIP | haiku | - | - | readonly |
| 30 | health_observation | 7 SHIP | sonnet | - | - | readonly |

### Parallel Groups & Dependencies

| Group | Sub-phases | Dependency |
|-------|-----------|------------|
| parallel_analysis | threat_modeling, planning | planning waits for threat_modeling |
| parallel_design | state_machine, flowchart, ui_design | ui_design waits for state_machine + flowchart |
| parallel_quality | build_check, code_review | none |
| parallel_verification | manual_test, security_scan, performance_test, e2e_test | none |

### Task Sizing

| Size | Risk Score | Phases | Use Case |
|------|-----------|--------|----------|
| small | 0-3 | ~12 | Single-file fix, typo, config |
| medium | 4-7 | ~22 | Multi-file feature, bug fix |
| large | 8+ | 30 | Architecture change, security, new subsystem |

Phase sets: small = scope -> research -> requirements -> impl -> build -> testing -> commit -> deploy. Medium adds threat/design/regression/security. Large = all 30.

---

## 2. Phase Work Descriptions

### Stage 0: scope_definition
Identify entry points and affected file scope using ast-grep pattern matching and ts-morph dependency graphs (1-2 hops). Call `harness_set_scope` (max 100 files; propose subtask decomposition if exceeded). Output: `scope-definition.md`. DoD: L1 exists, L3 files <= 100, L4 entry_points non-empty.

### Stage 1: research
Investigate existing code via Glob/Grep/Read. Include intent analysis section (UI-3): surface request, deep need, unclear points (tagged `【確認必要】`), assumptions. Output: `research.md`. DoD: L1 exists, L3 >= 30 lines, L4 `## サマリー` + `## ユーザー意図の分析`.

### Stage 1: impact_analysis (IA-7: after research, before requirements)
Build reverse dependency graph via ts-morph, identify affected tests via vitest --related. Max depth 3, max 200 files. Output: `impact-analysis.md`. DoD: L1 exists, L3 >= 20 lines, L4 required fields.

### Stage 2: requirements
Define AC-1 through AC-N (min 3, format `AC-N: desc`). Write `## NOT_IN_SCOPE`, `## OPEN_QUESTIONS`, `## ユーザー意図との整合性確認`. Register ACs via `harness_add_ac`. DoD: L3 AC >= 3, L4 OPEN_QUESTIONS empty, NOT_IN_SCOPE present. Gate: `approve("requirements")`.

### Stage 2: threat_modeling (parallel_analysis)
STRIDE analysis. Output: `threat-model.md`. DoD: L1 exists, L3 >= 30 lines, L4 required sections.

### Stage 2: planning (waits for threat_modeling)
Technical spec. Register F-NNN via `harness_add_rtm`. Output: `spec.md`. DoD: L1 exists, L3 >= 40 lines, L4 F-NNN with spec.

### Stage 3: state_machine (parallel_design)
stateDiagram-v2, named Start/End, min 3 states. Output: `state-machine.mmd`.

### Stage 3: flowchart (parallel_design)
flowchart TD, min 3 nodes, 2 edges. Output: `flowchart.mmd`.

### Stage 3: ui_design (waits for state_machine + flowchart)
For web: Storybook stories as specs (CDD). For CLI/API: command interfaces, error messages. Output: `ui-design.md`.

### Stage 3: design_review
Verify AC-to-Design mapping covers all ACs. Gate: `approve("design")`.

### Stage 4: test_design
TC-{AC#}-{seq} naming, every AC >= 1 TC. Output: `test-design.md`. Gate: `approve("test_design")`.

### Stage 4: test_selection
Select tests via vitest --related. Output: `test-selection.md`.

### Stage 4: test_impl (TDD Red)
Write failing tests. Register via `harness_record_test`. CDD: stories first, then unit tests. DoD: L2 tests executed, >= 1 FAILS.

### Stage 5: implementation (TDD Green)
Make tests pass. Verify ALL design items. ComponentDAG for large tasks (topological layers). Update RTM to "implemented". Checklist: all spec functions, state transitions, flows, UI elements, test cases implemented. DoD: L2 tsc exit 0, L2 all tests GREEN.

### Stage 5: refactoring
Improve quality. Mandatory /simplify (SMP-1): 3 parallel subagents. Tests MUST still pass. DoD: L2 tests pass, tsc exit 0.

### Stage 6: build_check (parallel_quality)
Run build/tsc/eslint/madge --circular. Fix all errors.

### Stage 6: code_review (parallel_quality, **opus** model, SRB-1)
Sections: `## サマリー`, `## 設計-実装整合性`, `## ユーザー意図との整合性`, `## AC Achievement Status`. Unimplemented -> harness_back. DoD: L4 AC table zero failures. Gate: `approve("code_review")`.

### Stage 6: testing
Execute all tests. **Baseline capture mandatory** via `harness_capture_baseline`. Record via `harness_record_test_result`. DoD: L2 all exit 0, L1 baseline captured.

### Stage 6: regression_test
Compare with baseline. Fix change-caused failures. Known bugs via `harness_record_known_bug`. DoD: L3 new failures = 0.

### Stage 6: acceptance_verification
Final intent gate. All ACs + RTM. Output: `acceptance-report.md`. Gate: `approve("acceptance")`.

### Stage 7: manual_test (parallel_verification)
Verify scenarios not covered by automation. Output: `manual-test.md`. Required sections: `## テストシナリオ`, `## テスト結果`. DoD: L1 exists, L3 >= 30 lines.

### Stage 7: security_scan (parallel_verification)
Scan for vulnerabilities, check dependencies. Output: `security-scan.md`. Required sections: `## 脆弱性スキャン結果`, `## 検出された問題`. DoD: L1 exists, L3 >= 30 lines.

### Stage 7: performance_test (parallel_verification)
Measure response time, memory, load. Output: `performance-test.md`. Required sections: `## パフォーマンス計測結果`, `## ボトルネック分析`. DoD: L1 exists, L3 >= 30 lines.

### Stage 7: e2e_test (parallel_verification)
User scenario verification, integration testing. Output: `e2e-test.md`. Required sections: `## E2Eテストシナリオ`, `## テスト実行結果`. DoD: L1 exists, L3 >= 30 lines.

### Stage 7: docs_update
Update permanent docs in `docs/spec/`, `docs/architecture/`. Update CHANGELOG.md, README.md. Workflow docs (`docs/workflows/`) are temporary and not committed.

### Stage 7: commit
`git add` + `git commit`. Bash: readonly + git only. **No rm allowed** (implementation category excluded). If file deletion needed, use `harness_back` to return to implementation first. No push to main/master/release directly (C-04).

### Stage 7: push
`git push` to feature branch. Branch protection: never force-push to main/master/release.

### Stage 7: ci_verification
Verify CI/CD pipeline: build success, all tests pass, lint/static analysis clean, security scan OK.

### Stage 7: deploy
Deploy to target environment. Verify deployment health.

### Stage 7: health_observation
Post-deploy monitoring for >= 5 minutes. Thresholds: error rate < +0.5%, P99 latency < +20%, throughput drop < 10%. Output: `health-report.md`. DoD: L1 exists, L3 >= 15 lines, L4 metrics within thresholds.
