# Implementation Tasks: separate-workflow-harness-from-parent

Phase: implementation
Execution model: single Worker task (all steps sequential in submodule shell)
Parent repo: READ-ONLY. Do not modify parent git state.
Submodule target: C:/ツール/Workflow/workflow-harness/

## Pre-verified facts
- Parent has 28 ADR files (ADR-001..ADR-027 plus one duplicate numbering)
- Parent has 27 workflow-phases md files
- Parent `.claude/hooks/` has 13 entries (2 to skip: check_ocr.py, pre-tool-guard.sh)
- Submodule `.mcp.json` uses key `workflow-harness` (NOT `harness` as planning.md says)
- Submodule `.mcp.json` current cwd = `"workflow-harness"` — must become `"."`
- Submodule has dirty unrelated files in mcp-server/; W-7 must stage ONLY target paths
- Submodule current branch: main

## W-1: ADR migration
Source: /c/ツール/Workflow/docs/adr/*.md (28 files)
Target: /c/ツール/Workflow/workflow-harness/docs/adr/
Commands:
  mkdir -p /c/ツール/Workflow/workflow-harness/docs/adr
  cp -p /c/ツール/Workflow/docs/adr/*.md /c/ツール/Workflow/workflow-harness/docs/adr/
Verify:
  COUNT=$(ls /c/ツール/Workflow/workflow-harness/docs/adr/*.md | wc -l)
  test "$COUNT" -ge 28 || exit 1
Report: COUNT value

## W-2: workflow-phases migration
Source: /c/ツール/Workflow/.claude/workflow-phases/*.md (27 files)
Target: /c/ツール/Workflow/workflow-harness/.claude/workflow-phases/
Commands:
  mkdir -p /c/ツール/Workflow/workflow-harness/.claude/workflow-phases
  cp -p /c/ツール/Workflow/.claude/workflow-phases/*.md /c/ツール/Workflow/workflow-harness/.claude/workflow-phases/
Verify:
  COUNT=$(ls /c/ツール/Workflow/workflow-harness/.claude/workflow-phases/*.md | wc -l)
  test "$COUNT" -eq 27 || exit 1
Report: COUNT value

## W-3: hooks migration (11 files; preserve exec bit)
Source dir: /c/ツール/Workflow/.claude/hooks/
Target dir: /c/ツール/Workflow/workflow-harness/.claude/hooks/
File list (exactly these 11):
  context-watchdog.sh
  handoff-reader.sh
  handoff-validator.sh
  harness-enforce.sh
  post-commit-auto-push.sh
  post-tool-lint.sh
  pre-compact-context-save.sh
  pre-tool-config-guard.sh
  pre-tool-gate.sh
  pre-tool-no-verify-block.sh
  test-guard.sh
EXCLUDE: check_ocr.py, pre-tool-guard.sh (already in submodule, do not touch)
Commands:
  mkdir -p /c/ツール/Workflow/workflow-harness/.claude/hooks
  for f in context-watchdog.sh handoff-reader.sh handoff-validator.sh harness-enforce.sh post-commit-auto-push.sh post-tool-lint.sh pre-compact-context-save.sh pre-tool-config-guard.sh pre-tool-gate.sh pre-tool-no-verify-block.sh test-guard.sh; do
    cp -p "/c/ツール/Workflow/.claude/hooks/$f" "/c/ツール/Workflow/workflow-harness/.claude/hooks/$f" || { echo "FAIL: $f"; exit 1; }
  done
Verify: all 11 files present in target; pre-tool-guard.sh and rtk-rewrite.sh still present (untouched)
Report: confirmation all 11 copied

## W-4: commands migration
Source: /c/ツール/Workflow/.claude/commands/{handoff.md,harness-report.md,recall.md}
Target: /c/ツール/Workflow/workflow-harness/.claude/commands/
Commands:
  mkdir -p /c/ツール/Workflow/workflow-harness/.claude/commands
  cp -p /c/ツール/Workflow/.claude/commands/handoff.md /c/ツール/Workflow/workflow-harness/.claude/commands/
  cp -p /c/ツール/Workflow/.claude/commands/harness-report.md /c/ツール/Workflow/workflow-harness/.claude/commands/
  cp -p /c/ツール/Workflow/.claude/commands/recall.md /c/ツール/Workflow/workflow-harness/.claude/commands/
Verify: 3 files present
Report: confirmation

## W-5: rules migration
Source: /c/ツール/Workflow/.claude/rules/{code-search-policy.md,rtk-scope.md}
Target: /c/ツール/Workflow/workflow-harness/.claude/rules/ (dir already exists)
Commands:
  cp -p /c/ツール/Workflow/.claude/rules/code-search-policy.md /c/ツール/Workflow/workflow-harness/.claude/rules/
  cp -p /c/ツール/Workflow/.claude/rules/rtk-scope.md /c/ツール/Workflow/workflow-harness/.claude/rules/
Verify: both files present
Report: confirmation

## W-6: .mcp.json cwd fix
File: /c/ツール/Workflow/workflow-harness/.mcp.json
IMPORTANT: planning.md says key is `.mcpServers.harness.cwd` but actual key is `.mcpServers.workflow-harness.cwd`. Use the actual key.
Before:
  Read the file. Current content (verified by coordinator):
    {
      "mcpServers": {
        "workflow-harness": {
          "command": "node",
          "args": ["mcp-server/dist/index.js"],
          "cwd": "workflow-harness"
        }
      }
    }
Change: cwd value from "workflow-harness" to "."
Method: Use Edit tool with old_string = `"cwd": "workflow-harness"` → new_string = `"cwd": "."`
Verify:
  jq -r '.mcpServers["workflow-harness"].cwd' /c/ツール/Workflow/workflow-harness/.mcp.json
  Expected output: .
Report: before value ("workflow-harness") and after value (".")

## W-7: submodule commit + push
Working dir: /c/ツール/Workflow/workflow-harness/
CRITICAL: submodule has unrelated dirty files in mcp-server/. Do NOT use `git add -A`. Only stage the paths touched by W-1..W-6.
Commands:
  cd /c/ツール/Workflow/workflow-harness
  git add docs/adr .claude/workflow-phases .claude/hooks .claude/commands .claude/rules/code-search-policy.md .claude/rules/rtk-scope.md .mcp.json
  git status --short | head -60
  git commit -m "$(cat <<'MSGEOF'
feat: import parent assets for standalone operation

- docs/adr: 28 ADR files from parent repo
- .claude/workflow-phases: 27 phase spec files
- .claude/hooks: 11 harness hooks (context-watchdog, handoff, lint, gate, etc)
- .claude/commands: handoff, harness-report, recall slash commands
- .claude/rules: code-search-policy, rtk-scope
- .mcp.json: fix cwd from "workflow-harness" to "." for standalone execution

Parent repo will be removed after this migration. Submodule must run standalone.
MSGEOF
)"
  git log -1 --oneline
  git push origin main
  git log origin/main..HEAD
Verify: last command outputs nothing (push succeeded)
Report: commit hash, push result

## Post-step parent check
Commands:
  cd /c/ツール/Workflow
  git status --porcelain | grep workflow-harness || echo "no submodule hash change in parent index"
Report: whether parent sees submodule hash update. Do NOT commit parent.

## Failure handling
Stop at first failing step. Report which W-N failed and include error output.
