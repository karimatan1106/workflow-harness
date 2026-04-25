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
- `ok`: agent returned and produced expected output (a "Report:" section, requested file paths, or all required step summaries)
- `stall`: agent returned mid-reasoning. Indicators:
  - Output ends with "Let me ...", "I'll ...", "Now I need to ...", or similar prelude phrase
  - Output is a single paragraph with no concrete result
  - Required "Report:" / artifact-path summary is missing
  - Output references "let me check" / "let me look" without follow-through
- `error`: agent reported [FAIL] / threw exception / explicitly stated blocked

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
