phase: scope_definition
task: workflow-harness-refactoring-v2
status: complete

## decisions

- SD-1: hooks/ の200行超ファイル(tool-gate.js 237行)を分割し、JSON.parse散在をhook-utils.jsに集約する (コード品質と200行制限準拠のため)
- SD-2: indexer/ のserena-query.py(276行)はSerena MCP登録済みのため削除する (CLIラッパーが不要化したため)
- SD-3: mcp-server/src/ の200行超ファイル4件(delegate-coordinator.ts 367行, lifecycle.ts 243行, dod-l1-l2.ts 221行, defs-stage1.ts 202行)を責務分割する (200行制限準拠のため)
- SD-4: skills/ の6ファイルで古い"CLAUDE.md SecN"参照を現行構造に更新し、禁止語リスト重複を解消する (ドキュメント整合性のため)
- SD-5: harness_approveのフェーズ遷移責務をharness_nextに一本化する。approveは承認記録のみ、nextが唯一の遷移ポイントとする (責務分離のため)
- SD-6: 5領域は相互依存なしで並列実行可能とする (リスク低減と効率化のため)

scopeItems:
  area1: hooks/ - tool-gate.js分割、hook-utils拡張、JSON.parse統一 (6ファイル)
  area2: indexer/ - serena-query.py削除 (3ファイル+.venv)
  area3: mcp-server/src/ - 200行超4ファイル責務分割 (4ファイル)
  area4: skills/ - stale参照更新、重複削除 (6ファイル)
  area5: mcp-server/src/ - harness_approve遷移ロジック分離 (approval.ts + lifecycle.ts)

totalFilesInScope: 28
filesExceeding200Lines: 6
parallelTasks: 5

notInScope:
  hooks/pre-tool-guard.sh (前回v1で修正済み)
  hooks/block-dangerous-commands.js (既にparseHookInput使用)
  mcp-server/src/ のテストファイル (実装変更に追従して更新)

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/scope-definition.md, spec, スコープ定義(5領域、28ファイル)

## next

criticalDecisions: harness_approve遷移分離は他4領域と独立して実装可能
readFiles: scope-definition.md, hearing.md
warnings: indexer削除はSerena MCPの動作確認が前提
