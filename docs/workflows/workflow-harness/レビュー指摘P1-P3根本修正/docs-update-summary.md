# docs_updateフェーズ - P1-P3根本修正ドキュメント更新

## 実施日

2026年2月16日（docs_updateフェーズ）

## 更新対象ドキュメント

### 1. PLUGIN_CHANGELOG.md（変更履歴）

**更新内容:**
- Version 2.1.0 から Version 2.2.0 へ記載を更新
- 3つの主要な機能強化と修正項目を新規記載：
  - P1: PhaseGuideにuserIntentフィールド追加
  - P2: InputFileMetadata型の追加
  - P3: フック修正（spec-first-guard.js, loop-detector.js）

**変更点:**
- 旧バージョン表記（FIX-1～FIX-6）をP1-P3分類に変更
- 各修正項目の効果と影響範囲を明記

### 2. workflow-mcp-server.md（MCP仕様書）

**更新内容:**

**サマリーセクション:**
- CLAUDE.mdフェーズ別パーサー、userIntent、InputFileMetadataの3つの追加機能を記載

**PhaseGuide構造定義:**
- InputFileMetadata型を新規定義（path, importance, readMode）
- PhaseGuide型にuserIntent?: stringを追加
- PhaseGuide型にinputFileMetadata?: InputFileMetadata[]を追加

**変更履歴:**
- P3, P2, P1の順序で変更内容を詳細に記載
- 実装対象ファイル、効果、目的を明確に記述

### 3. workflow-plugin-maintenance.md（保守ガイド）

**更新内容:**
- 「最新の修正履歴（2026年2月16日）」セクションを新規作成
- Version 2.2.0の機能強化と修正内容を詳細に記載

**記載項目:**
- P1: userIntentフィールド追加による意図伝播
- P2: InputFileMetadataによるコンテキスト最適化
- P3: フック安定性修正（getLatestTask()、タスク優先順序）

### 4. workflow-mcp-server-types.md（型定義仕様）

**更新内容:**
- 変更履歴に新エントリを追加：「2026-02-16: PhaseGuideの拡張」
- InputFileMetadata型の定義を記載

**記載内容:**
- PhaseGuide型拡張の詳細（userIntent, inputFileMetadata, content）
- InputFileMetadata型の構造（path, importance, readMode）
- 3つの効果：意図認識、ファイル読み込み効率化、コンテキスト最適化

## 永続的なドキュメント配置

以下のドキュメントは `docs/spec/` および `docs/operations/` に永続配置されます：

- `docs/operations/PLUGIN_CHANGELOG.md` - ワークフロープラグイン変更履歴
- `docs/spec/features/workflow-mcp-server.md` - MCP仕様書（永続）
- `docs/spec/features/workflow-mcp-server-types.md` - 型定義仕様
- `docs/operations/workflow-plugin-maintenance.md` - 保守ガイド

## 実装ファイルと仕様書の対応関係

| 実装ファイル | 関連仕様書 | 対応項目 |
|-----------|---------|--------|
| `workflow-plugin/mcp-server/src/state/types.ts` | workflow-mcp-server-types.md | InputFileMetadata型、PhaseGuide型拡張 |
| `workflow-plugin/mcp-server/src/phases/definitions.ts` | workflow-mcp-server.md | PHASE_GUIDES定義、inputFileMetadata設定 |
| `workflow-plugin/mcp-server/src/tools/status.ts` | workflow-mcp-server.md | userIntent引数伝播 |
| `workflow-plugin/mcp-server/src/tools/next.ts` | workflow-mcp-server.md | userIntent引数伝播 |
| `workflow-plugin/hooks/spec-first-guard.js` | workflow-plugin-maintenance.md | P3a修正内容 |
| `workflow-plugin/hooks/loop-detector.js` | workflow-plugin-maintenance.md | P3b修正内容 |

## subagentへの情報提供

本docs_updateフェーズで更新されたドキュメントにより、次のタスクのsubagentは以下の情報を入手可能になります：

1. **workflow_status/workflow_nextレスポンスの新フィールド:**
   - userIntent: タスク開始時のユーザー意図
   - inputFileMetadata: 入力ファイルの重要度と読み込みモード
   - content: フェーズ固有のCLAUDE.mdセクション

2. **フック安定性の向上:**
   - spec-first-guard.js の信頼性向上
   - loop-detector.js の複数タスク対応

3. **型定義の明確化:**
   - InputFileMetadata型による入力ファイル管理
   - PhaseGuide型の完全な構造理解

## 次フェーズへの引き継ぎ

docs_updateフェーズが完了することで、以下が実現されます：

- ドキュメントと実装コードの完全な同期
- 永続的な仕様書による長期的な参照性の確保
- 次のタスク実行時の参考資料として機能

## 確認項目

以下の点を確認済みです：

- 4つの主要ドキュメントを版数を保つまま更新（古いファイルは削除せずgitで管理）
- 実装内容と仕様書の対応関係を明記
- 変更の背景・目的・効果を明確に記述
- バージョン管理とドキュメント品質を維持

---

**作成日**: 2026-02-16
**フェーズ**: docs_update
**文書完了度**: 100%
