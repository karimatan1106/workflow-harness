# レビュー指摘事項全件修正 - 調査結果

## サマリー

- 目的: レビューで指摘された15件の問題の根本原因を特定する
- 主要な発見: 問題は5カテゴリに分類される（設計不足、スケーラビリティ欠如、セキュリティトレードオフ、実装不完全、柔軟性不足）
- 次フェーズで必要な情報: 各問題の修正対象ファイルと修正方針

## 根本原因分析

### CRITICAL-1: ユーザー指示の追跡メカニズムが存在しない

**根本原因**: TaskState型定義（`state/types.ts`）に`userIntent`フィールドが存在しない。`workflow_start`ツール（`tools/start.ts`）は`taskName`のみを記録する。

**影響箇所**:
- `mcp-server/src/state/types.ts` - TaskState型定義
- `mcp-server/src/tools/start.ts` - タスク開始ツール
- `mcp-server/src/tools/status.ts` - ステータス表示ツール

**設計意図の推測**: 当初は`taskName`で十分と想定していたが、subagentパターン導入後にコンテキスト伝搬の問題が顕在化した。

### CRITICAL-2: セマンティック一貫性チェックが粗すぎる

**根本原因**: キーワード抽出が単純な正規表現のみ（`artifact-validator.ts`のextractKeywords関数）。

**問題のコード**: `/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ffa-zA-Z0-9]{3,}/g`で3文字以上の連続文字を抽出するのみ。日本語形態素解析なし、同義語辞書なし。

**設計意図**: 軽量な実装を優先し、形態素解析ライブラリ（kuromoji等）の依存追加を避けた。

### CRITICAL-3: スコープ制限が大規模プロジェクトに不適合

**根本原因**: 固定上限値と一括設定API。

**問題の定義箇所**:
- `scope-validator.ts`: MAX_SCOPE_FILES=1000, MAX_SCOPE_DIRS=100
- `tools/set-scope.ts`: 全ファイル/ディレクトリを一度に指定する設計

**欠如している機能**: 増分追加API（addToScope）、パターンベースのスコープ定義。

### HIGH-1: 全タスク19フェーズ強制

**根本原因**: v1.5.0でsmall/mediumサイズを廃止し、MANDATORY_PHASESの範囲を拡大した。

**問題箇所**:
- `phases/definitions.ts`: MANDATORY_PHASES配列にresearch, requirements, parallel_analysis, completedが含まれる
- `tools/start.ts`: skipPhasesパラメータは存在するがMANDATORY_PHASESを除外できない
- MAX_SKIP_COUNT = 9（全体の50%）の制限

**設計意図**: 品質の一貫性を優先したが、小規模修正の生産性を犠牲にした。

### HIGH-2: design_review以外にユーザー承認ゲートがない

**根本原因**: `tools/approve.ts`が3種類の承認タイプ（requirements, design, test_design）のみをサポート。implementation後やtesting後の承認ゲートが未実装。

**影響**: AIが自己レビュー（code_review）を行うが、ユーザーの明示的な承認なしに次フェーズに進む。

### HIGH-3: workflow-state.jsonのconfig bypass

**根本原因**: `enforce-workflow.js`がworkflow-state.jsonをHMAC検証前にバイパスする（行165-168）。

**設計意図の推測**: MCPサーバーがworkflow-state.jsonを頻繁に更新するため、hooksでブロックすると循環問題が発生する。しかし、MCPサーバー以外からの編集もバイパスされてしまう。

**修正方針**: バイパスを維持しつつ、MCPサーバーのみが書き込み可能な仕組み（プロセスID検証等）を検討。ただしClaude Codeのhook環境では実装が困難なため、代替策としてHMAC検証を通過させた上でバイパスする設計に変更。

### HIGH-4: シェルビルトインによるコマンドチェーン回避

**根本原因**: `bash-whitelist.js`のSHELL_BUILTINS定義でcd, echo, true, false等をホワイトリストチェックから除外している。コマンドチェーン（&&, ||, ;）で連結された後続コマンドの検証が不完全。

**修正方針**: ビルトインの後に&&/||/;で連結されたコマンドを再帰的に検証する。

### HIGH-5: テストベースラインの硬直性

**根本原因**: `TestBaseline`型が単一オブジェクトで、上書きのみ可能。既知のテスト失敗を許容する「例外リスト」機構がない。

**修正方針**: `knownFailures`フィールドを追加し、`workflow_record_known_bug`で登録された既知バグのテストを除外して比較する。

### SEC-3: 正規表現バイパス

**根本原因**: `block-dangerous-commands.js`がコマンド文字列を正規化せずに正規表現マッチングする。クォート挿入、タブ文字、バックスラッシュエスケープでワード境界を破壊可能。

**修正方針**: マッチング前にコマンド文字列を正規化（クォート除去、空白統一、エスケープ解除）する前処理を追加。

### SEC-4: 環境変数による検証無効化

**根本原因**: HMAC_STRICT, SCOPE_STRICT, SEMANTIC_CHECK_STRICT等の環境変数が認証なしで検証を無効化できる。

**問題箇所**:
- `state/manager.ts`: HMAC_STRICT=falseで署名検証をバイパス
- `scope-validator.ts`: SCOPE_STRICT=falseでスコープ外変更を警告のみに
- `artifact-validator.ts`: SEMANTIC_CHECK_STRICT=falseでセマンティックチェックを警告のみに

**修正方針**: bash-whitelist.jsのSECURITY_ENV_VARS保護を強化し、export/unsetをブロック。MCP server側でも環境変数の変更を検出してaudit logに記録。

### DES-1: テーブルデータ行の全除外

**根本原因**: `artifact-validator.ts`のisStructuralLine関数で`/^\|.*\|$/.test(trimmed)`によりテーブルデータ行を全て構造行として除外している。

**本来除外すべき**: テーブルセパレータ（`|---|---|`）のみ
**誤って除外**: テーブルデータ行（`| 項目 | 説明 |`）

**修正方針**: セパレータパターン（`/^\|[\s\-:]+\|$/`）のみを構造行として除外するよう変更。

## 根本原因の分類

| カテゴリ | 該当問題 | 共通原因 |
|---------|---------|---------|
| 設計不足 | CRITICAL-1, HIGH-2 | subagentパターン導入時の考慮漏れ |
| スケーラビリティ欠如 | CRITICAL-2, CRITICAL-3 | 小規模プロジェクト前提の設計 |
| セキュリティとUXのトレードオフ | HIGH-3, SEC-4 | 開発利便性とセキュリティの両立が不十分 |
| 実装不完全 | HIGH-4, SEC-3, DES-1 | エッジケースの考慮不足 |
| 柔軟性不足 | HIGH-1, HIGH-5 | 一律適用の設計思想 |
