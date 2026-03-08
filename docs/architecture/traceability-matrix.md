# Traceability Matrix

baseCommit: c01d689 | FR-6 | AC-6

命名規則で自明な対応(例: `hmac.ts` / `hmac.test.ts`)は省略。非自明な対応のみ個別記載。

---

## 1. Source File - Test File Mapping

48ソースファイル、40テストファイル(うちヘルパー2件除外で38テストスイート)。

| Source | Test(s) | 備考 |
|--------|---------|------|
| state/manager.ts | manager-core, manager-lifecycle, manager-lifecycle-reset, manager-scope | 4テストに分割 |
| state/manager-write.ts | manager-core, manager-lifecycle | manager.ts経由で間接テスト |
| state/manager-read.ts | manager-core | manager.ts経由で間接テスト |
| state/manager-invariant.ts | invariant-manager, invariant-dogfooding | 2テストスイート |
| state/types-invariant.ts | invariant-types | |
| gates/dod.ts | dod-basic | |
| gates/dod-l1-l2.ts | dod-basic, dod-format | |
| gates/dod-l3.ts | dod-l3-baseline, dod-l3-l4-content | |
| gates/dod-l4-content.ts | dod-l3-l4-content | |
| gates/dod-l4-requirements.ts | dod-l4-requirements, dod-ia, dod-ia-coverage, dod-ia5 | IA-1/IA-2含む |
| gates/dod-l4-ia.ts | dod-ia, dod-ia5, dod-ia-coverage | IA-3/IA-4/IA-5 |
| gates/dod-l4-refs.ts | dod-l4-refs | |
| gates/dod-l4-commit.ts | dod-l4-commit | |
| gates/dod-l4-delta.ts | dod-l4-sections | |
| gates/dod-helpers.ts | dod-format | |
| gates/dod-l4-art.ts | dod-basic | 間接テスト |
| tools/handler.ts | handler-lifecycle, handler-misc, handler-misc-ia2 | |
| tools/handler-shared.ts | handler-session-force, handler-templates-s1, handler-templates-validation | |
| tools/handlers/lifecycle.ts | handler-lifecycle | |
| tools/handlers/approval.ts | handler-approval | |
| tools/handlers/scope-nav.ts | handler-traceability, handler-parallel, handler-parallel-pha1 | |
| tools/handlers/recording.ts | handler-traceability | |
| tools/reflector.ts + reflector-types.ts | ace-reflector, ace-reflector-curator | |
| tools/curator.ts + curator-helpers.ts | ace-reflector-curator | |
| tools/ace-context.ts | ace-reflector-curator | |
| tools/retry.ts | retry | |
| phases/risk-classifier.ts | risk-classifier, risk-classifier-classify | |
| phases/definitions.ts | handler-templates-s1, handler-templates-s6-docs, handler-templates-s6-docs-integration | |
| index.ts | serena-integration | MCP統合テスト |
| cli.ts | cli | |

**テスト未対応ソース**(8件): state/types.ts, state/types-core.ts, gates/dod-types.ts, gates/dod-l4-toon.ts, phases/definitions-shared.ts, phases/defs-stage1.ts-defs-stage6.ts(6ファイル一括), phases/registry.ts, tools/defs-a.ts, tools/defs-b.ts, tools/handlers/query.ts。型定義・定数定義が中心のためテスト不要。

---

## 2. Source File - Specification Document Mapping

| Module | Files | Primary Spec |
|--------|-------|-------------|
| Entry | index.ts, cli.ts | [overview](../overview.md) |
| Phases | phases/*.ts (10files) | [phase-system](../../spec/features/phase-system.md) |
| Gates | gates/*.ts (14files) | [gate-system](../../spec/features/gate-system.md) |
| Tools | tools/*.ts, tools/handlers/*.ts (15files) | [mcp-tools](../../spec/features/mcp-tools.md) |
| State | state/*.ts (7files) | [state-management](modules/state-management.md) |
| Utils | utils/hmac.ts | [state-management](modules/state-management.md) |

全48ソースファイルがFR-1〜FR-5のいずれかに帰属。未カバーファイルなし。

---

## 3. Test File - Functional Category Mapping

| Category | Test Files | Count |
|----------|-----------|-------|
| Gate Validation | dod-basic, dod-format, dod-l3-baseline, dod-l3-l4-content, dod-l4-commit, dod-l4-duplicate, dod-l4-refs, dod-l4-requirements, dod-l4-sections, dod-tdd | 10 |
| Intent Accuracy (IA) | dod-ia, dod-ia5, dod-ia-coverage | 3 |
| Tool Handling | handler-lifecycle, handler-misc, handler-misc-ia2, handler-approval, handler-session-force, handler-templates-s1, handler-templates-validation, handler-templates-s6-docs, handler-templates-s6-docs-integration | 9 |
| Parallel Phases | handler-parallel, handler-parallel-pha1 | 2 |
| Traceability (AC/RTM) | handler-traceability | 1 |
| State Persistence | manager-core, manager-lifecycle, manager-lifecycle-reset, manager-scope | 4 |
| Invariants | invariant-manager, invariant-dogfooding, invariant-types | 3 |
| Security (HMAC) | hmac | 1 |
| Learning Pipeline | ace-reflector, ace-reflector-curator | 2 |
| Phase Management | risk-classifier, risk-classifier-classify | 2 |
| Retry | retry | 1 |
| Integration | serena-integration, cli | 2 |

---

## 4. Coverage Summary

| Metric | Value |
|--------|-------|
| Source files | 48 |
| Test suites | 38 (+ 2 helper) |
| Source files with direct/indirect test | 40/48 (83%) |
| Source files without test | 8 (型定義・定数定義) |
| Spec docs | 5 (FR-1〜FR-5) |
| Source files mapped to spec | 48/48 (100%) |
| Functional categories | 12 |
