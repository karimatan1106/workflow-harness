# Internal .toon File Inventory

All .toon files referenced in workflow-harness/mcp-server/src/ (TypeScript source).

## State Management

| File | Location | Purpose |
|------|----------|---------|
| workflow-state.toon | .claude/state/workflows/{taskId}_{taskName}/ | Per-task workflow state (phase, status, HMAC, history) |
| task-index.toon | .claude/state/ | Global index of all registered tasks |
| claude-progress.toon | docs/workflows/{task}/ | Human-readable task progress summary |
| hmac-keys.toon | .claude/state/ | HMAC signing keys for state tamper detection |

## Knowledge and Learning

| File | Location | Purpose |
|------|----------|---------|
| reflector-log.toon | .claude/state/ | Phase reflection log (lessons learned per phase) |
| ace-context.toon | .claude/state/ | Cross-task knowledge store (promoted high-quality lessons) |
| curator-log.toon | .claude/state/ | Curator curation log for knowledge quality control |

## Architecture and Design

| File | Location | Purpose |
|------|----------|---------|
| design-code-index.toon | .claude/state/ | Design-Code Index mapping specs to implementation files |
| adr-store.toon | .claude/state/ | Architecture Decision Records store |
| archgate-rules.toon | .claude/state/ | Architecture gate rules for constraint enforcement |

## Telemetry and Analytics

| File | Location | Purpose |
|------|----------|---------|
| metrics.toon | .claude/state/ | Accumulated metrics store (durations, counts) |
| phase-metrics.toon | docs/workflows/{task}/ | Per-phase detailed metrics output |
| phase-analytics.toon | docs/workflows/{task}/ | Aggregated phase analytics (generated on task completion) |
| phase-errors.toon | docs/workflows/{task}/ | DoD failure log recorded as errors occur |

## Total: 14 unique .toon files

Split by storage location:
- .claude/state/ (persistent internal): 8 files
- docs/workflows/{task}/ (per-task output): 4 files
- .claude/state/workflows/{id}/ (per-workflow): 2 files (workflow-state.toon, task-index.toon at parent)
