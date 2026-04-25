# Hearing

## background
pre-tool-gate hookとMCPサーバの状態ストアの配置と形式が食い違い、harness_start後もWrite/Edit権限が解放されない。

### 具体ミスマッチ
- hookが参照: parent/.claude/state/task-index.json と parent/.claude/state/workflows/*/workflow-state.json (JSON形式)
- MCPが書き込み: workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/*/workflow-state.toon (二重ネストパス + TOON形式)

### 二重原因
1. .mcp.jsonのSTATE_DIR=workflow-harness/mcp-server/.claude/stateが相対パス。start.shのcd "$(dirname "$0")"と二重解決され workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/ にネスト
2. hookのgetActivePhaseFromWorkflowStateはJSON形式のみ読むが、MCP側はTOON形式で書く

### 影響
- 新規タスクはbootstrap（手動で親側stateファイル作成）しない限り進められない
- ADR-028で進めているsubmodule分離の完成形から外れている

## userResponse
userResponse: 4件全てRecommended選択。STATE_DIR絶対化とhookのTOON対応までを単一PRで実施し、legacy JSONとの互換は維持、bootstrap機構は修正完了後に完全削除する。
- Q1「修正範囲はどこまで」: STATE_DIR絶対化 + hookのTOON対応まで (Recommended選択)
- Q2「legacy JSON state扱い」: 互換維持。hookはJSONとTOON両方読む (Recommended選択)
- Q3「bootstrap機構」: 完全削除。修正完了で不要なので親側workflow-state.jsonも消す (Recommended選択)
- Q4「ロールアウト」: 単一PRでアトミックに適用 (Recommended選択)

## decisions
- D-001: 修正範囲はSTATE_DIR絶対パス化とhookのTOON読み取り対応の2点に限定する。自動ミラー機構は導入しない
- D-002: hookのstate読み取りはJSON形式とTOON形式を両対応にする。新規書き込みはTOON形式を標準とする
- D-003: 修正完了後、親側bootstrap成果物（workflow-state.json、task-index.jsonのactiveエントリ）を完全削除する
- D-004: hook+MCP+ADR+bootstrapクリーンアップを単一PRでアトミックに適用する
- D-005: ADR-029「hook-mcp-state-sync」を新規作成しWhyドキュメントとする
- D-006: submoduleの二重ネストパスを排除し、hookが実データ配置を直接参照できる構造にする

## artifacts
- 編集予定: C:/ツール/Workflow/.mcp.json （STATE_DIR絶対パス化）
- 編集予定: C:/ツール/Workflow/workflow-harness/mcp-server/start.sh （パス解決ロジック）
- 編集予定: C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js （getActivePhaseFromWorkflowState拡張）
- 新規: C:/ツール/Workflow/docs/adr/ADR-029-hook-mcp-state-sync.md （Whyドキュメント）
- 削除予定: C:/ツール/Workflow/.claude/state/workflows/30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync/ （bootstrap痕跡）
- 編集予定: C:/ツール/Workflow/.claude/state/task-index.json （bootstrap追加エントリの削除）

## next
- requirements フェーズへ進み、AC-N と RTM F-NNN を定義する
- scope_definition でscopeFiles/scopeDirsを固定
- 受入基準としてbootstrapなしで新規タスクが起動しWrite/Edit可能になることを定める

## constraints
- 成果物ソースは各200行以内に収める
- 新ルール追加時にADR必須（.claude/rules/documentation-layers.md準拠）
- bootstrap依存コードは最終状態に残さない
- 既存のlegacyステートファイルを破損させない
- L1-L4決定的ゲートのみ使用。L5（LLM判断ゲート）は使わない
