---
name: harness-phases
description: 30 phase work descriptions across 8 stages with DoD checks and task sizing.
---
> CLAUDE.md Sec2(Phase一覧)/Sec3(Task Sizing) が権威仕様。本ファイルは各フェーズの作業内容のみ。

Phase sets: small(~12)=scope→research→requirements→impl→build→testing→commit→deploy. Medium(~22) adds threat/design/regression/security. Large(30)=all.

## Phase Work Descriptions

### Stage 0: scope_definition
Identify entry points and affected files via ast-grep/ts-morph (1-2 hops). Call `harness_set_scope` (max 100 files; propose subtask if exceeded). Output: `scope-definition.toon`. DoD: L1 exists, L3 files <= 100, L4 entry_points non-empty.

### Stage 1: research
Investigate existing code via Glob/Grep/Read. Include intent analysis (UI-3): surface request, deep need, unclear points (`【確認必要】`), assumptions. Output: `research.toon`. DoD: L1 exists, L3 >= 30 lines, L4 `## サマリー` + `## ユーザー意図の分析`.

### Stage 1: impact_analysis (IA-7: after research, before requirements)
Build reverse dependency graph via ts-morph, identify affected tests via vitest --related. Max depth 3, max 200 files. Output: `impact-analysis.toon`. DoD: L1 exists, L3 >= 20 lines.

### Stage 2: requirements
Define AC-1~AC-N (min 3). Write `## NOT_IN_SCOPE`, `## OPEN_QUESTIONS`, `## ユーザー意図との整合性確認`. Register via `harness_add_ac`. DoD: L3 AC >= 3, L4 OPEN_QUESTIONS empty, NOT_IN_SCOPE present. Gate: `approve("requirements")`.

### Stage 2: threat_modeling (parallel_analysis)
STRIDE analysis. Output: `threat-model.toon`. DoD: L1 exists, L3 >= 30 lines.

### Stage 2: planning (waits for threat_modeling)
Technical spec. Register F-NNN via `harness_add_rtm`. Output: `spec.toon`. DoD: L1 exists, L3 >= 40 lines, L4 F-NNN with spec.

### Stage 3: state_machine / flowchart / ui_design (parallel_design)
- state_machine: stateDiagram-v2, named Start/End, min 3 states. Output: `state-machine.mmd`.
- flowchart: flowchart TD, min 3 nodes, 2 edges. Output: `flowchart.mmd`.
- ui_design (waits for state_machine + flowchart): Web→Storybook stories as specs (CDD). CLI/API→command interfaces. Output: `ui-design.toon`.

### Stage 3: design_review
Verify AC-to-Design mapping covers all ACs. Gate: `approve("design")`.

### Stage 4: test_design / test_selection
- test_design: TC-{AC#}-{seq} naming, every AC >= 1 TC. Output: `test-design.toon`. Gate: `approve("test_design")`.
- test_selection: Select tests via vitest --related. Output: `test-selection.toon`.

### Stage 4: test_impl (TDD Red)
Write failing tests. Register via `harness_record_test`. CDD: stories first, then unit tests. DoD: L2 tests executed, >= 1 FAILS.

### Stage 5: implementation (TDD Green)
Make tests pass. Verify ALL design items. ComponentDAG for large tasks. Update RTM to "implemented". Checklist: all spec functions, state transitions, flows, UI elements, test cases. DoD: L2 tsc exit 0, all tests GREEN.

### Stage 5: refactoring
Improve quality. Mandatory /simplify (SMP-1): 3 parallel subagents. Tests MUST still pass. DoD: L2 tests pass, tsc exit 0.

### Stage 6: build_check / code_review (parallel_quality)
- build_check: Run build/tsc/eslint/madge --circular. Fix all errors.
- code_review (**opus**, SRB-1): Sections: `## サマリー`, `## 設計-実装整合性`, `## ユーザー意図との整合性`, `## AC Achievement Status`. Unimplemented → harness_back. Gate: `approve("code_review")`.

### Stage 6: testing / regression_test
- testing: Execute all tests. **Baseline capture mandatory** via `harness_capture_baseline`. Record via `harness_record_test_result`. DoD: L2 all exit 0, baseline captured.
- regression_test: Compare with baseline. Fix change-caused failures. Known bugs via `harness_record_known_bug`. DoD: L3 new failures = 0.

### Stage 6: acceptance_verification
Final intent gate. All ACs + RTM. Output: `acceptance-report.toon`. Gate: `approve("acceptance")`.

### Stage 7: parallel_verification
- manual_test: Verify scenarios not covered by automation. Required: `## テストシナリオ`, `## テスト結果`.
- security_scan: Vulnerability scan + dependency check. Required: `## 脆弱性スキャン結果`, `## 検出された問題`.
- performance_test: Response time, memory, load. Required: `## パフォーマンス計測結果`, `## ボトルネック分析`.
- e2e_test: User scenario + integration. Required: `## E2Eテストシナリオ`, `## テスト実行結果`.
All DoD: L1 exists, L3 >= 30 lines.

### Stage 7: docs_update
Update permanent docs in `docs/spec/`, `docs/architecture/`. Update CHANGELOG.md, README.md. Workflow docs temporary.

### Stage 7: commit / push
- commit: `git add` + `git commit`. Bash: readonly + git only. **No rm** (implementation category excluded). Need deletion → `harness_back` to implementation.
- push: `git push` to feature branch. Never force-push to main/master/release (C-04).

### Stage 7: ci_verification / deploy / health_observation
- ci_verification: Build success, all tests pass, lint/static analysis clean, security scan OK.
- deploy: Deploy to target environment. Verify health.
- health_observation: Post-deploy monitoring >= 5 min. Thresholds: error rate < +0.5%, P99 latency < +20%, throughput drop < 10%. Output: `health-report.toon`.
