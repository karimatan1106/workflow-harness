# 調査結果 - ワークフロー構造的問題完全解決

## サマリー

ワークフロープラグインの6つの構造的問題を調査し、修正箇所と方針を特定した。

## 既存実装の分析

### 問題1: HMAC移行期間（署名検証が常にtrue）
- **ファイル**: `mcp-server/src/state/manager.ts` - `verifyStateHmac()` (行216-244)
- **状態**: 4箇所全てで`return true`。署名検証が完全に無効
- **修正方針**: デフォルトで厳格モード、環境変数`HMAC_STRICT=false`で緩和可能にする

### 問題2: 承認ゲートがdesign_reviewの1箇所のみ
- **ファイル**: `mcp-server/src/phases/definitions.ts` - `REVIEW_PHASES`, `APPROVE_TYPE_MAPPING` (行260-270)
- **ファイル**: `mcp-server/src/tools/next.ts` - `requiresApproval()` チェック (行134-139)
- **ファイル**: `mcp-server/src/tools/approve.ts` - `workflowApprove()` (行22-69)
- **修正方針**: `requirements`, `test_design`, `code_review` に承認ゲート追加

### 問題3: 成果物品質検証が表面的
- **ファイル**: `mcp-server/src/validation/artifact-validator.ts` - `validateArtifactQuality()` (行80-160)
- **状態**: 行数・セクション存在・禁止パターンのみ。内容の充実度は未検証
- **修正方針**: セクション最小文字数、Mermaid構文検証、コンテンツ比率チェック追加

### 問題4: テスト数・カバレッジの回帰チェックなし
- **ファイル**: `mcp-server/src/tools/next.ts` - testing/regression_test遷移 (行186-218)
- **状態**: `exitCode === 0` のみチェック。テスト数0件でも通過
- **ファイル**: `mcp-server/src/state/types.ts` - `TestBaseline` (行132-141) は定義済だが未使用
- **修正方針**: baseline比較でテスト数減少・パス数低下を検出

### 問題5: スコープがAI自己申告に依存
- **ファイル**: `mcp-server/src/tools/set-scope.ts` - `workflowSetScope()` (行39-218)
- **ファイル**: `mcp-server/src/validation/scope-validator.ts` - 各種検証関数
- **状態**: ファイル存在・深度・サイズのみ。実装後の実際の変更ファイルとの照合なし
- **修正方針**: commit前にgit diff結果とスコープを照合、乖離を検出

### 問題6: subagent制御がプロンプト依存
- **ファイル**: `mcp-server/src/tools/next.ts`, `approve.ts`, `reset.ts` 等
- **状態**: MCPサーバーに呼び出し元識別機構なし
- **修正方針**: フェーズセッショントークン方式で技術的にブロック
