# Edit Authorization Logic Analysis

## 1. Two Guard Systems

There are TWO independent hook systems that control edit authorization:

### A. pre-tool-guard.sh (bash, Orchestrator-level gate)

Location: `workflow-harness/hooks/pre-tool-guard.sh`
Activated via: `.claude/hooks/pre-tool-guard.sh` (wrapper)

This guard only applies to the Orchestrator (no agent_id). Subagents (any request with agent_id) bypass entirely at line 35-37:
```
if [ -n "$AGENT_ID" ]; then
  exit 0
fi
```

For Orchestrator Edit calls, it checks `.agent/edit-auth.txt`:
- File must exist
- Target file_path must appear in the file (grep -qF exact substring match)
- This is the "edit-preview" workflow: Worker prepares edits, writes paths to edit-auth.txt, Orchestrator executes

The `.toon` and `.mmd` extensions are unconditionally allowed for Orchestrator Write/Edit (lines 53-58), bypassing the edit-auth check entirely.

### B. tool-gate.js (Node.js, all-layer phase-dependent gate)

Location: `workflow-harness/hooks/tool-gate.js`

This is the more comprehensive guard with layer detection and phase-aware rules.

## 2. Worker Edit Authorization (tool-gate.js)

Workers (L3) are controlled by `checkL3()` -> `checkWriteEdit()`:

1. `isBypassPath()` check: paths containing `workflow-harness/`, `.claude/projects/.../memory/`, or `.claude/settings` always pass
2. Phase extension check via `PHASE_EXT` map: each phase has a whitelist of allowed file extensions
   - Most research/doc phases: only `.md`
   - Implementation: broad set (.ts, .tsx, .js, .css, .json, etc.)
   - build_check/commit/push/completed: `null` (no writes allowed)

There is NO path-based restriction for workers -- only extension-based. A worker in `scope_definition` phase can write any `.md` file anywhere (subject to bypass path logic).

## 3. docs/workflows/ Path Handling

In `checkWriteEdit()` (tool-gate.js lines 152-154):
```js
if (layer !== 'worker' && filePath.replace(/\/g, '/').includes('docs/workflows/')) {
  return 'Direct editing of phase artifacts is forbidden. Delegate to workers.';
}
```

This means:
- Workers CAN write to `docs/workflows/` (the check passes them through)
- Coordinators and Orchestrators CANNOT write to `docs/workflows/` directly -- they get blocked with "Delegate to workers"
- This is independent of the edit-auth.txt mechanism

## 4. edit-auth.txt Mechanism Details

- File: `.agent/edit-auth.txt`
- Written by: Worker (in edit-preview mode), append mode, one path per line
- Read by: pre-tool-guard.sh (Orchestrator Edit gate)
- Scope: Only affects Orchestrator-layer Edit calls
- Does NOT affect Worker or Coordinator layer (they never hit this code path)
- Currently does NOT exist in the workspace (checked: file not present)

The edit-auth.txt has NO mechanism for adding `docs/workflows/` paths because:
1. It is only relevant for Orchestrator Edit calls
2. Orchestrator Edit to `docs/workflows/` is blocked EARLIER by tool-gate.js (line 152-154)
3. Even if edit-auth.txt contained a docs/workflows/ path, tool-gate.js would block it first

## 5. .agent/ Control Files

Found in `.agent/`:
- `.worker-allowed-extensions`: contains `.md,.mmd` (appears to be a runtime config)
- `.worker-allowed-tools`: contains `Read,Glob,Grep,Write`
- NO `edit-auth.txt` currently exists

These `.worker-allowed-*` files are NOT referenced by either hook. They may be legacy or used by a different mechanism (possibly MCP server or coordinator prompt logic).

## 6. Gaps Identified

### Gap A: edit-auth.txt is redundant for docs/workflows/
The edit-preview flow (Worker writes edit-auth.txt, Orchestrator executes Edit) cannot work for `docs/workflows/` paths because tool-gate.js blocks Orchestrator/Coordinator from writing there regardless of edit-auth.txt contents.

### Gap B: Coordinator Write to docs/workflows/ blocked
Coordinators (L2) hit the same `docs/workflows/` block in tool-gate.js (line 152: `layer !== 'worker'`). This means coordinator-generated phase artifacts MUST go through a Worker, even for simple .md writes. This is by design per tool-delegation.md but worth noting.

### Gap C: pre-tool-guard.sh vs tool-gate.js overlap
Both hooks run. For Orchestrator Edit calls:
1. pre-tool-guard.sh checks edit-auth.txt
2. tool-gate.js checks L1 rules (which block Edit entirely for Orchestrator via checkL1)

In tool-gate.js checkL1(), Edit is NOT in L1_ALLOWED set, so Orchestrator Edit would be blocked by tool-gate.js regardless of edit-auth.txt. The pre-tool-guard.sh edit-auth check is unreachable when tool-gate.js is active.

However, pre-tool-guard.sh does allow `.toon`/`.mmd` Write/Edit for Orchestrator (lines 53-58), which tool-gate.js would block. This creates a conflict depending on hook execution order.

### Gap D: .worker-allowed-extensions not enforced by hooks
The `.agent/.worker-allowed-extensions` file (`.md,.mmd`) is not referenced by any hook code. It may be dead configuration.
