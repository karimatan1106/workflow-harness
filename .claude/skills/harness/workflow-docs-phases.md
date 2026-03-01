---
name: harness-docs-phases
description: Per-phase document creation guide with CDD + TDD integration.
---

## Project-Common Documents (Initial Setup Only)

Created once at project start; only updated thereafter.

| Document | Description |
|----------|-------------|
| `docs/glossary.md` | Domain dictionary |
| `docs/spec/design-system/overview.md` | Design system (color, typography, spacing) |
| `docs/spec/personas/{name}.md` | Persona definitions |
| `docs/architecture/overview.md` | System overview |
| `docs/architecture/auth.md` | Auth/authorization design |
| `docs/architecture/performance.md` | Performance requirements |
| `docs/architecture/caching.md` | Caching strategy |
| `docs/guides/storybook-setup.md` | Storybook setup guide |

## Per-Phase Document Creation

### 1. research

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `{docsDir}/research.md` | ✅ | Research results, existing implementation analysis |

### 2. requirements

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/glossary.md` | - | Add new terms if any |
| 2 | `docs/spec/user-stories/{name}.md` | - | User stories |
| 3 | `docs/spec/journeys/{persona}-{journey}.md` | - | User journey maps |
| 4 | `docs/spec/features/{name}.md` | ✅ | Feature spec |
| 5 | `{docsDir}/requirements.md` | ✅ | Requirements (workflow artifact) |

### 3a. threat_modeling (parallel_analysis)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `{docsDir}/threat-model.md` | ✅ | Threat model (workflow artifact) |
| 2 | `docs/security/threat-models/{project}.md` | ✅ | Threat model (enterprise placement) |

### 3b. planning (parallel_analysis)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/spec/database/{table}.md` | ✅ | DB design (ER diagram, table defs) |
| 2 | `docs/spec/api/{api}.md` | ✅ | API spec (endpoint design) |
| 3 | `docs/architecture/modules/{module}.md` | ✅ | Module detailed design |
| 4 | `{docsDir}/spec.md` | ✅ | Spec (workflow artifact) |

Note: auth, caching, performance are project-common documents.

### 4a. state_machine (parallel_design)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `{docsDir}/state-machine.mmd` | ✅ | State machine diagram (workflow) |
| 2 | `docs/spec/diagrams/{target}.state-machine.mmd` | ✅ | State machine (enterprise) |

### 4b. flowchart (parallel_design)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `{docsDir}/flowchart.mmd` | ✅ | Flowchart (workflow) |
| 2 | `docs/spec/diagrams/{target}.flowchart.mmd` | ✅ | Flowchart (enterprise) |

### 4c. ui_design (parallel_design)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/spec/sitemap.md` | ✅ | Sitemap / screen transitions |
| 2 | `docs/spec/screens/{name}.md` | ✅ | Screen design spec |
| 3 | `docs/spec/components/{name}.md` | ✅ | Component spec + **Storybook story definitions** |
| 4 | `docs/spec/interactions/{name}.md` | - | Interaction/animation design |
| 5 | `docs/spec/responsive/{name}.md` | - | Responsive design (breakpoints) |
| 6 | `docs/spec/accessibility/{name}.md` | - | Accessibility requirements (WCAG) |
| 7 | `docs/spec/seo/{name}.md` | - | SEO requirements |
| 8 | `docs/spec/i18n/{name}.md` | - | Internationalization requirements |
| 9 | `docs/spec/messages/{name}.md` | - | Message design (errors, notifications) |
| 10 | `{docsDir}/ui-design.md` | ✅ | UI design (workflow artifact) |

CDD: Component specs must include Storybook story definitions (Default/Variants/States, args/controls, interaction test scenarios).

### 5. design_review

No documents created. Review and approval only.

### 6. test_design

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/testing/plans/{project}.md` | ✅ | Test plan |
| 2 | `{docsDir}/test-design.md` | ✅ | Test design (workflow artifact) |

### 7. test_impl [CDD: Red Phase]

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `src/**/*.stories.tsx` | ✅ | Storybook stories (based on ui_design spec) |
| 2 | `src/**/*.test.ts` | ✅ | Unit test code (failing state) |

### 8. implementation [CDD: Green Phase]

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `src/**/*.tsx` | ✅ | Component/module implementation (make stories + tests pass) |
| 2 | `docs/architecture/decisions/{NNNN-title}.md` | - | ADR for significant design decisions |

Pre-implementation checklist: read spec.md, state-machine.mmd, flowchart.mmd, ui-design.md, test-design.md before writing any code.

### 9. refactoring

No documents created. Code quality improvement only.

### 10a. build_check (parallel_quality)

No documents created. Build error fixes only.

### 10b. code_review (parallel_quality)

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `{docsDir}/code-review.md` | ✅ | Review results (design-implementation consistency, quality, security, performance, user intent) |

### 11. testing

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/testing/reports/{project}-{date}.md` | ✅ | Test result report |

### 12. parallel_verification

| Subphase | Document | Req |
|----------|----------|-----|
| manual_test | `{docsDir}/manual-test.md` | ✅ |
| security_scan | `{docsDir}/security-scan.md` | ✅ |
| performance_test | `{docsDir}/performance-test.md` | ✅ |
| e2e_test | `{docsDir}/e2e-test.md` | ✅ |

### 13. docs_update

| # | Document | Req | Description |
|---|----------|-----|-------------|
| 1 | `docs/architecture/overview.md` | - | Update if changed |
| 2 | `docs/operations/environments/{env}.md` | - | Environment definitions |
| 3 | `docs/operations/deployment/{target}.md` | - | Deploy runbook |
| 4 | `docs/operations/monitoring/{service}.md` | - | Monitoring/log design |
| 5 | `docs/operations/runbooks/{name}.md` | - | Operational runbooks |
| 6 | `CHANGELOG.md` | - | Change history |
| 7 | `README.md` | - | README update |

## Document Creation Flow

```
[Project-common: initial only]
  glossary, design-system, personas, architecture overview
         ↓ task start
research → requirements (user-stories → features)
         ↓
parallel_analysis ┬─ threat_modeling → threat-model.md
                  └─ planning → DB/API/module specs → spec.md
         ↓
parallel_design ┬─ state_machine → .mmd
                ├─ flowchart    → .mmd
                └─ ui_design    → screens/components[Storybook] → ui-design.md
         ↓
design_review (approve)
         ↓
test_design → test plan + test-design.md
         ↓
[test_impl: Red]  .stories.tsx + .test.ts (failing)
         ↓
[implementation: Green]  .tsx (make tests pass)
         ↓
refactoring → parallel_quality (build_check + code_review)
         ↓
testing → parallel_verification (manual/security/perf/e2e)
         ↓
docs_update → commit → push → ci_verification → deploy → completed
```

## CDD + TDD Cycle

```
ui_design         test_impl          implementation
┌──────────┐     ┌──────────┐       ┌──────────────┐
│ Story    │ →   │ Story    │  →    │ Component    │
│ defined  │     │ impl     │       │ impl         │
│ (spec)   │     │ (Red)    │       │ (Green)      │
└──────────┘     └──────────┘       └──────────────┘
     ↓                ↓                   ↓
component spec   .stories.tsx        .tsx files
in docs/spec/    file created        stories pass
```
