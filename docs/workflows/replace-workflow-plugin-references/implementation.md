phase: implementation
status: blocked
summary: workflow-plugin → workflow-harness 置換は test ファイル 11 件で phase-edit-guard により block。実装が成立しないまま完了不可。

## decisions
- IMPL-1: replace_all を用いた systematic 置換方針を採用（test ファイル 11 件は同手順で実施を試みた）。
- IMPL-2: 5 ファイル名 rename は前 worker により git mv 完了済み（PLUGIN_CHANGELOG → HARNESS_CHANGELOG 他）。
- IMPL-3: dispatch-log / handoff history / 本タスクの artifacts は意図的に残存する（履歴記録用途のため置換不要）。

## artifacts
- workflow-plugin 文字列の content edit: 前 worker により doc 系 54 ファイル + コード系で完了。
- file rename: 5 ファイル（前 worker 完了）
- 本 worker の対象: test ファイル 11 件（下記参照）

## test files attempted (all blocked by phase-edit-guard)
1. src/backend/tests/unit/hooks/test-bug1-bash-whitelist.test.ts — BLOCKED
2. src/backend/tests/unit/hooks/test-bug2-loop-detector.test.ts — BLOCKED
3. src/backend/tests/unit/hooks/test-bug3-record-test-result.test.ts — BLOCKED
4. src/backend/tests/unit/hooks/test-n1-scope-validator.test.ts — BLOCKED
5. src/backend/tests/unit/hooks/test-n2-phase-edit-guard.test.ts — BLOCKED
6. src/backend/tests/unit/hooks/test-n3-test-authenticity.test.ts — BLOCKED
7. src/backend/tests/unit/hooks/test-n4-enforce-workflow.test.ts — BLOCKED
8. src/backend/tests/unit/hooks/test-n5-set-scope.test.ts — BLOCKED
9. src/backend/tests/unit/hooks/test-n6-security-new.test.ts — BLOCKED
10. src/backend/tests/regression/hook-fixes/regression.test.ts — BLOCKED
11. src/backend/tests/unit/hooks/verify-fixes.test.ts — BLOCKED

block reason (全件共通):
`Extension ".test.ts" not allowed in phase "implementation". Allowed: .ts, .tsx, .js, .jsx, .css, .json, .html, .md, .py, .go, .rs, .java, .yml, .yaml, .toml, .env, .sh`

source: `workflow-harness/hooks/phase-config.js` の PHASE_EXT.implementation には `.test.ts` 系拡張子が含まれない。`getEffectiveExtension` は二重拡張子（.test.ts 等）を優先返却するため `.ts` フォールバックも無効。

## hook file existence audit (workflow-harness/hooks/)
test ファイルが require/参照しているフックを workflow-harness/hooks/ で確認した結果、以下が **存在しない**:
- workflow-harness/hooks/bash-whitelist.js — N/A
- workflow-harness/hooks/phase-edit-guard.js — N/A
- workflow-harness/hooks/enforce-workflow.js — N/A
- workflow-harness/hooks/lib/phase-definitions.js — N/A
- workflow-harness/mcp-server/src/tools/record-test-result.ts — N/A
- workflow-harness/mcp-server/src/validation/scope-validator.ts — N/A
- workflow-harness/mcp-server/src/validation/test-authenticity.ts — N/A
- workflow-harness/mcp-server/src/tools/set-scope.ts — N/A

実在する hook (`workflow-harness/hooks/*.js`):
- block-dangerous-commands.js
- loop-detector.js
- session-boundary.js
- context-watchdog.js
- phase-config.js
- tool-gate.js
- hook-utils.js

つまり仮に置換が成功しても、テストは require 解決に失敗する。これは本タスクのスコープ外（hook 実体の relocate は別タスク）。

## final grep status
`workflow-plugin` 残存 14 ファイル:
- 履歴/意図的残存 (3): `.agent/dispatch-log.toon`, `lefthook.yml`, `.agent/handoff/2026-03-07-0000.md`
- test files 11 件 (本タスクで処理予定だが phase guard により block)

## next
- criticalDecisions: phase-edit-guard をバイパスする手段が必要。選択肢: (a) test_impl/refactoring フェーズへ移行して実施 (b) phase-config.js の PHASE_EXT.implementation に `.test.ts` を追加 (c) 別 phase で本タスクのみ完遂後 implementation 復帰
- readFiles: workflow-harness/hooks/phase-config.js, .claude/state/workflows/{taskId}/workflow-state.toon
- warnings: テスト files の置換が完了しても hook 実体が workflow-harness/hooks/ に存在しないため、テスト走行は失敗する。本タスクのスコープ外だが orchestrator に escalate 必要。
- warnings: lefthook.yml にも `workflow-plugin` 参照あり（grep 結果より）。意図的か再評価が必要。
