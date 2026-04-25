## Overview
タスク名: harness-first-pass-improvement
目的: ハーネスの1発通過率を改善
変更対象: coordinator.md, worker.md, defs-stage4.ts の3ファイル

## Change Summary
### 1. coordinator.md (+12行)
- Phase Output Rulesセクション追加
- coordinatorエージェントの全委譲動作に影響
- 変更種別: エージェント定義テキスト追加

### 2. worker.md (+3行)
- Edit Completeness rule追加
- Worker全edit操作に影響
- 変更種別: エージェント定義テキスト追加

### 3. defs-stage4.ts (+6行)
- implementation/code_reviewテンプレートにbaseline/RTM手順追加
- 該当2フェーズのsubagent指示に影響
- 変更種別: テンプレート文字列追加

## Dependency Analysis
- 3ファイル間に相互依存なし。独立して変更可能。
- coordinator.md: Claude Code Agent定義。ランタイム読み込み（エージェント起動時）
- worker.md: Claude Code Agent定義。ランタイム読み込み（エージェント起動時）
- defs-stage4.ts: MCPサーバーのフェーズ定義。ビルド時コンパイル対象

## Test Impact Analysis

### defs-stage4.ts を参照するテスト
1. `workflow-harness/mcp-server/src/__tests__/dci-phase-integration.test.ts`
   - DEFS_STAGE4をimportし、implementationテンプレートの内容をアサーション
   - TC-AC3-01: `@spec` 文字列の存在チェック (`expect(tpl).toMatch(/@spec/)`)
   - TC-AC3-02: 新規ファイルの@specコメント指示チェック (`expect(tpl).toMatch(/新規.*@spec|@spec.*新規|@spec.*コメント/)`)
   - 影響判定: baseline/RTM手順の追加は既存アサーションに干渉しない。既存の`@spec`文字列は削除されないため、テストは引き続きパスする。

### hearing-template.test.ts
   - DEFS_STAGE0(hearing)のみを参照。DEFS_STAGE4は未参照。
   - 影響判定: 影響なし。

### coordinator.md を参照するファイル
- テストファイルでcoordinator.mdを直接参照するものはなし
- 参照元はADR文書、ワークフロー状態ファイル、メトリクスファイルのみ（ドキュメント参照）
- 影響判定: テスト影響なし

### worker.md を参照するファイル
- `workflow-harness/mcp-server/src/__tests__/hearing-worker-rules.test.ts` が存在するが、これはhearing-worker.mdを参照しており、worker.mdは未参照
- 他にworker.mdを直接参照するテストファイルはなし
- 影響判定: テスト影響なし

### 結論
既存テストへの破壊的影響はゼロ。dci-phase-integration.test.tsはDEFS_STAGE4.implementationテンプレートをアサーションしているが、チェック対象は`@spec`関連文言のみであり、baseline/RTM手順の追加とは無関係。テスト修正は不要。

## Risk Assessment
- ランタイムロジック変更: なし（全てテキスト/テンプレート追加のみ）
- 破壊的変更: なし（既存内容の削除・修正なし、追加のみ）
- ビルド影響: defs-stage4.tsはTypeScriptコンパイル対象。構文エラーの可能性は低い（文字列リテラル追加のみ）
- 200行制限: 下記IA-005参照

## decisions
- IA-001: 3ファイルは独立変更可能。依存関係なし
- IA-002: coordinator.md/worker.mdはエージェント定義テキストのみ。テスト影響なし
- IA-003: defs-stage4.tsのテンプレート文字列変更は既存テストに影響しない。dci-phase-integration.test.tsのアサーション対象(@spec関連)と追加内容(baseline/RTM)は無関係
- IA-004: 全変更はテキスト追加のみ。既存行の削除・修正なし。後方互換性あり
- IA-005: 200行制限チェック: coordinator.md 37行(+12=49行), worker.md 56行(+3=59行), defs-stage4.ts 185行(+6=191行)。全ファイル200行以内
- IA-006: ビルドチェック不要判定（文字列リテラル追加のみで構文変更なし）

## artifacts
- impact_analysis.md (本ファイル)

## next
- implementationフェーズで3ファイルを並行して変更可能
- テスト文言アサーション対応は不要（既存テストへの影響なし）
