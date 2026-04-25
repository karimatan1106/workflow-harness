# Scope Definition

## background
pre-tool-gate hookとMCPサーバの状態ストアの配置ずれにより、harness_startしてもWrite/Edit権限が解放されない。本タスクはSTATE_DIR相対パスの二重ネストとhookのTOON未対応を同時解消する。

## scopeFiles
- C:/ツール/Workflow/.mcp.json
- C:/ツール/Workflow/workflow-harness/mcp-server/start.sh
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js

## scopeDirs
- C:/ツール/Workflow/docs/adr （ADR-029新規追加先）
- C:/ツール/Workflow/.claude/state （bootstrap成果物の削除先）

## notInScope
- src/frontend/** 全般
- workflow-harness/mcp-server/src/** のビジネスロジック
- tests/ 既存テストの大幅改修
- 他の未修正stateファイル（legacy JSON）への破壊的マイグレーション

## keywords
state sync, hook pre-tool-gate, MCP server, STATE_DIR absolute path, TOON format, bootstrap removal, ADR-029

## decisions
- D-001: STATE_DIRを絶対パスで指定する形に変更し、二重ネスト問題を構造的に解消する
- D-002: hook-utils.jsのgetActivePhaseFromWorkflowStateをTOON形式の読み取りに対応させる
- D-003: hookはJSON形式とTOON形式の両方を読む互換維持実装とし、legacy stateを壊さない
- D-004: 修正完了後に親側のbootstrap成果物（.claude/state/workflows/30fba95f.../とtask-index.jsonのactiveエントリ）を削除する
- D-005: 単一PRでアトミックに適用し、hook＋MCP＋ADR＋bootstrapクリーンアップを同時マージする
- D-006: ADR-029「hook-mcp-state-sync」を新規作成してWhyを固定する

## artifacts
- 編集: .mcp.json （envのSTATE_DIRを絶対パスへ変更）
- 編集: workflow-harness/mcp-server/start.sh （必要ならprefix解決の補助を追加）
- 編集: workflow-harness/hooks/hook-utils.js （TOON読み取り関数を追加、既存JSON処理は保持）
- 確認: workflow-harness/hooks/tool-gate.js （hook-utils呼び出し部の整合確認）
- 新規: docs/adr/ADR-029-hook-mcp-state-sync.md
- 削除: .claude/state/workflows/30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync/
- 編集: .claude/state/task-index.json （本タスクのactiveエントリを除去）

## next
- requirements フェーズへ進む
- AC-N（受入基準）とRTM F-NNN（要件追跡）を定義する
- 特にbootstrap不要で新規タスクがWrite可能になることを受入条件化する

## constraints
- 各ソースファイル200行以内
- 新規ルール追加にADR必須
- legacy JSONステートを破壊しない
- L1-L4決定的ゲートのみ使用
