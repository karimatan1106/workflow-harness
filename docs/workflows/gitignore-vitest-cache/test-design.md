phase: test_design
status: stub
summary: Express mode skips test_design phase. Stub for DoD input_files_exist on running MCP.

## decisions
- STUB-1: Express skips this phase per MODE_PHASES.express
- STUB-2: Test strategy embedded in scope-definition AC-1/AC-2/AC-3
- STUB-3: Delete in follow-up after MCP rebuild

## artifacts
- docs/workflows/gitignore-vitest-cache/scope-definition.md (AC source)

## next
- criticalDecisions: testing phase verifies AC directly via grep + git status
- readFiles: workflow-harness/.gitignore
- warnings: stub file
