# Dispatch Log Schema

L1 (Orchestrator) appends one entry to `.agent/dispatch-log.toon` per `Agent()` dispatch. Used by `metrics-report.js` to aggregate token consumption and dispatch outcomes per task / phase.

## File location

`.agent/dispatch-log.toon` — repo-local, append-only TOON log. Not committed (gitignored).

## Entry shape (TOON)

```
entries[N]:
  - ts: 2026-04-25T10:30:00Z
    taskId: <taskId or "none">
    phase: <phase or "none">
    agentType: worker|coordinator|hearing-worker
    purpose: "1行ラベル"
    tokens: <total_tokens from agent completion>
    durationMs: <duration_ms from agent completion>
    result: ok|stall|error
```

`result` values:
- `ok`: agent returned and produced expected output
- `stall`: agent returned mid-reasoning without completing the task (orchestrator's judgment based on missing report sections)
- `error`: agent reported [FAIL] or threw

## Producer

L1 prompt rule (see `CLAUDE.md`): after each `Agent()` returns, append entry. Token + duration come from the agent completion notification (`<usage>total_tokens: ... duration_ms: ...`).

## Consumer

`workflow-harness/scripts/metrics-report.js --root .` reads this file and emits:
- Token consumption per phase (sum, mean, P95)
- Dispatch count per agent type
- Stall rate per phase
- Total task budget burn

## Privacy

No prompt content is logged. Only tokens, duration, type, purpose label.
