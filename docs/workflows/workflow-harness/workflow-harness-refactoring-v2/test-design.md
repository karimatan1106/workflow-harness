phase: test_design
task: workflow-harness-refactoring-v2
status: complete

## decisions

- TD-1: AC-1~AC-4,AC-6,AC-7 は grep/wc -l による L1 構造チェックで検証する。LLM判断不要。
- TD-2: AC-5 は grep で advancePhase/nextPhase の不在を確認する。L1 パターンマッチ。
- TD-3: AC-8,AC-9 はビルド・テスト実行の exit code で判定する。L2 実行チェック。
- TD-4: 全 TC は CI 再現可能な CLI コマンドで記述する。手動確認項目なし。
- TD-5: AC-3 はディレクトリ不在を test -d で判定する。ファイル単位の grep は不要。

## test-cases

### TC-1: tool-gate.js line count (AC-1)
method: wc -l workflow-harness/hooks/tool-gate.js
expected: < 200
gate: L1

### TC-2: phase-config.js exists with config data (AC-1)
method: test -f workflow-harness/hooks/phase-config.js && wc -l workflow-harness/hooks/phase-config.js
expected: file exists, line count > 0
gate: L1

### TC-3: No JSON.parse in loop-detector.js (AC-2)
method: grep -c "JSON\.parse" workflow-harness/hooks/loop-detector.js
expected: 0
gate: L1

### TC-4: No JSON.parse in context-watchdog.js (AC-2)
method: grep -c "JSON\.parse" workflow-harness/hooks/context-watchdog.js
expected: 0
gate: L1

### TC-5: No JSON.parse in session-boundary.js (AC-2)
method: grep -c "JSON\.parse" workflow-harness/hooks/session-boundary.js
expected: 0
gate: L1

### TC-6: hook-utils used by refactored hooks (AC-2)
method: grep -l "hook-utils" workflow-harness/hooks/loop-detector.js workflow-harness/hooks/context-watchdog.js workflow-harness/hooks/session-boundary.js
expected: 3 files listed
gate: L1

### TC-7: indexer/ directory deleted (AC-3)
method: test -d indexer/
expected: directory does not exist (exit code 1)
gate: L1

### TC-8: No serena-query.py remains (AC-3)
method: find . -name "serena-query.py" -o -name "requirements.txt" -path "*/indexer/*" -o -name "setup.sh" -path "*/indexer/*" | wc -l
expected: 0
gate: L1

### TC-9: No .venv directory in indexer (AC-3)
method: test -d indexer/.venv
expected: directory does not exist (exit code 1)
gate: L1

### TC-10: All non-test mcp-server/src/ files under 200 lines (AC-4)
method: find mcp-server/src/ -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" -exec wc -l {} + | awk '{if ($1 >= 200 && $2 != "total") print $0}'
expected: no output (all files < 200 lines)
gate: L1

### TC-11: harness_approve does not call advancePhase (AC-5)
method: grep -c "advancePhase" mcp-server/src/tools/approval.ts
expected: 0
gate: L1

### TC-12: No nextPhase in approval response (AC-5)
method: grep -c "nextPhase" mcp-server/src/tools/approval.ts
expected: 0
gate: L1

### TC-13: No "CLAUDE.md Sec" references in skills/ (AC-6)
method: grep -r "CLAUDE\.md Sec" .claude/skills/workflow-harness/
expected: no matches (exit code 1)
gate: L1

### TC-14: workflow-rules.md forbidden word list replaced with reference (AC-7)
method: grep -c "TODO\|TBD\|WIP\|FIXME" .claude/skills/workflow-harness/workflow-rules.md | head -1
expected: forbidden words defined by reference, not inline list duplication
note: verify the file uses a pointer to the authoritative list in forbidden-actions.md
gate: L1

### TC-15: npm run build succeeds (AC-8)
method: cd mcp-server && npm run build
expected: exit code 0
gate: L2

### TC-16: All tests pass (AC-9)
method: cd mcp-server && npm test
expected: exit code 0, no test failures
gate: L2

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/test-design.md, spec, テスト設計

## next

criticalDecisions: TD-1(L1構造チェック中心), TD-3(ビルド・テストはL2)
readFiles: docs/workflows/workflow-harness-refactoring-v2/test-design.md
warnings: TC-10 の find/awk は Windows Git Bash で実行すること。パス区切りに注意。
