---
name: harness-docs
description: Document directory structure, naming conventions, per-phase document creation guide with CDD+TDD integration.
---

## 1. Directory Structure

| Directory | Role | Examples |
|-----------|------|---------|
| `docs/spec/` | Product specs (persistent) | Feature specs, screen specs, API specs |
| `docs/workflows/` | Workflow work folder (**temporary, .gitignore**) | Research, design drafts |
| `docs/architecture/` | System design | ADR, overview, diagrams |
| `docs/security/` | Security | Threat models |
| `docs/testing/` | Testing | Test plans, reports |
| `docs/operations/` | Operations | Runbooks, deploy config |

**docs/spec/features/** = core documents. Each module describes: responsibility, interfaces, state transitions, edge cases, dependencies.

### docs/ Directory Tree

```
docs/
├── glossary.md
├── guides/
├── product/
│   ├── features/        # Feature specs (module unit)
│   ├── screens/ | api/ | events/ | database/ | messages/
│   ├── user-stories/ | personas/ | journeys/
│   ├── sitemap.md | seo/ | i18n/
│   ├── design-system/ | components/ | interactions/ | responsive/ | accessibility/ | wireframes/
│   └── diagrams/        # *.state-machine.mmd, *.flowchart.mmd
├── architecture/
│   ├── overview.md | decisions/ (ADR: NNNN-title.md) | modules/ | integrations/ | batch/
│   └── diagrams/
├── security/threat-models/
├── testing/ (plans/ | reports/)
├── operations/ (runbooks/ | deployment/ | environments/ | monitoring/)
└── workflows/{taskName}/   # Temporary work artifacts
```

## 2. Naming Conventions

File names use target name (not task name). All kebab-case.

| Category | Rule | Example |
|----------|------|---------|
| Feature spec | feature-name | `user-authentication.md` |
| Screen / API / DB / Module | target-name | `login-screen.md`, `users-api.md` |
| Diagram | target.type.mmd | `order.state-machine.mmd` |
| Threat model / Test plan | project/feature-name | `payment-system.md` |
| Test report | project-date | `checkout-20260118.md` |
| ADR | NNN-title | `0001-use-postgresql.md` |

Diagrams: `docs/architecture/diagrams/` (system-wide) / `docs/spec/diagrams/` (product features)

## 3. Per-Phase Document Creation

### Project-Common (Initial Setup Only)

| Document | Description |
|----------|-------------|
| `docs/glossary.md` | Domain dictionary |
| `docs/spec/design-system/overview.md` | Design system |
| `docs/spec/personas/{name}.md` | Persona definitions |
| `docs/architecture/overview.md` | System overview |
| `docs/architecture/auth.md` / `performance.md` / `caching.md` | Auth, perf, cache |
| `docs/guides/storybook-setup.md` | Storybook setup |

### research
- `{docsDir}/research.md` (required)

### requirements
- `docs/glossary.md` (update) / `docs/spec/user-stories/{name}.md` / `docs/spec/journeys/{persona}-{journey}.md`
- `docs/spec/features/{name}.md` (required) / `{docsDir}/requirements.md` (required)

### threat_modeling (parallel_analysis)
- `{docsDir}/threat-model.md` (required) / `docs/security/threat-models/{project}.md` (required)

### planning (parallel_analysis)
- `docs/spec/database/{table}.md` / `docs/spec/api/{api}.md` / `docs/architecture/modules/{module}.md` (all required)
- `{docsDir}/planning.md` (required). Note: auth/caching/performance are project-common.

### state_machine / flowchart (parallel_design)
- `{docsDir}/state-machine.mmd` + `docs/spec/diagrams/{target}.state-machine.mmd` (required)
- `{docsDir}/flowchart.mmd` + `docs/spec/diagrams/{target}.flowchart.mmd` (required)

### ui_design (parallel_design, waits for state_machine + flowchart)
- `docs/spec/sitemap.md` / `docs/spec/screens/{name}.md` / `docs/spec/components/{name}.md` (Storybook story定義含む)
- Optional: interactions/ responsive/ accessibility/ seo/ i18n/ messages/
- `{docsDir}/ui-design.md` (required). CDD: Component specs must include Storybook story definitions.

### design_review
No documents. Review and approval only.

### test_design
- `docs/testing/plans/{project}.md` / `{docsDir}/test-design.md` (both required)

### test_impl [CDD: Red Phase]
- `src/**/*.stories.tsx` (Storybook stories) / `src/**/*.test.ts` (failing tests)

### implementation [CDD: Green Phase]
- `src/**/*.tsx` (make stories + tests pass) / `docs/architecture/decisions/{NNNN-title}.md` (optional ADR)
- Pre-impl checklist: read planning.md, state-machine.mmd, flowchart.mmd, ui-design.md, test-design.md

### refactoring / build_check
No documents. Code quality / build error fixes only.

### code_review (parallel_quality)
- `{docsDir}/code-review.md` (required): design-impl consistency, quality, security, performance, user intent

### testing
- `docs/testing/reports/{project}-{date}.md` (required)

### parallel_verification
- manual_test: `{docsDir}/manual-test.md` / security_scan: `{docsDir}/security-scan.md`
- performance_test: `{docsDir}/performance-test.md` / e2e_test: `{docsDir}/e2e-test.md`

### docs_update
- Update `docs/architecture/overview.md`, `docs/operations/` (environments/deployment/monitoring/runbooks)
- Update `CHANGELOG.md`, `README.md`. Workflow docs (`docs/workflows/`) are temporary, not committed.

## 4. Artifact Placement

- `workflowDir`: `.claude/state/workflows/{taskId}_{taskName}/` — internal state (auto-created)
- `docsDir`: `docs/workflows/{taskName}/` — work artifacts (auto-created, .gitignore'd)
- Never use `docs/workflows/` in `@spec` comments; use persistent paths.
- Product spec reflection: feature→`docs/spec/features/`, screen→`docs/spec/screens/`, API→`docs/spec/api/`, diagram→`docs/spec/diagrams/`

## 5. Scope Setting

Set scope in research/requirements via `harness_set_scope`. Without scope, test_impl may be skipped. Include test files and source directories.

## 6. Mermaid Patterns

- State machine: `stateDiagram-v2` with `[*] --> Idle` named start/end
- Flowchart: `flowchart TD` with `A(開始) --> B{条件判定}` decision nodes
