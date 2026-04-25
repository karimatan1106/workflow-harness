# 調査結果: ワークフロープラグイン大規模対応根本改修

## 対象コードベース
- フック: `workflow-plugin/hooks/` (8ファイル, 4,281行)
- MCPサーバー: `workflow-plugin/mcp-server/src/` (ツール12+, テスト13+)
- 総規模: 約9,800行

## 1. FAIL_OPEN使用箇所 (12箇所)

| ファイル | 行番号 | コンテキスト |
|---------|--------|-------------|
| enforce-workflow.js | 35-39 | uncaughtException |
| enforce-workflow.js | 42-48 | unhandledRejection |
| enforce-workflow.js | 222-227 | stdin error |
| enforce-workflow.js | 236-240 | JSON parse error |
| enforce-workflow.js | 323-327 | main error |
| phase-edit-guard.js | 39-50 | exception handlers |
| phase-edit-guard.js | 1651-1655 | main error |
| phase-edit-guard.js | 1677-1681 | stdin error |
| phase-edit-guard.js | 1691-1695 | JSON parse error |
| block-dangerous-commands.js | 140-145 | error |
| block-dangerous-commands.js | 153-157 | stdin error |
| block-dangerous-commands.js | 164-168 | uncaught error |

## 2. 環境変数スキップ機構 (8箇所)

| 変数 | ファイル | 行 |
|------|---------|-----|
| SKIP_PHASE_GUARD | phase-edit-guard.js | 1442 |
| SKIP_SPEC_GUARD | spec-first-guard.js | 118 |
| SKIP_LOOP_DETECTION | loop-detector.js | 378 |
| SKIP_TEST_FIRST_CHECK | check-test-first.js | 248 |
| SKIP_ARTIFACT_CHECK | check-workflow-artifact.js | 113 |
| SKIP_DESIGN_VALIDATION | next.ts | 60-84 |
| VALIDATE_DESIGN_STRICT | next.ts | 60-84 |
| FAIL_OPEN | 複数ファイル | 12箇所 |

## 3. スコープ検証の現状

### phase-edit-guard.js (行1331-1385)
- `src/` 配下のみチェック対象
- `docs/` は常に許可
- affectedFiles: 完全一致
- affectedDirs: プレフィックスマッチ
- **問題**: サイズ制限なし、パス検証なし

### next.ts (行130-138)
- parallel_analysis→parallel_design遷移時のみチェック
- scope未設定 or 空配列→ブロック
- **問題**: ファイル数制限なし、実在確認なし

## 4. 成果物検証の現状

### next.ts 必須成果物
- research→requirements: research.md
- requirements→parallel_analysis: requirements.md
- test_design→test_impl: test-design.md

### complete-sub.ts 必須成果物
- threat_modeling: threat-model.md
- planning: spec.md
- state_machine: state-machine.mmd
- flowchart: flowchart.mmd
- ui_design: ui-design.md
- code_review: code-review.md

### check-workflow-artifact.js
- 空ファイル(0バイト): エラー
- 50バイト未満: 警告のみ
- **問題**: 内容品質チェックなし

## 5. 状態ファイル構造

### パス
`.claude/state/workflows/{taskId}_{taskName}/workflow-state.json`

### 構造 (TaskState)
```typescript
interface TaskState {
  phase: PhaseName;
  taskId: string;
  taskName: string;
  workflowDir: string;
  docsDir: string;
  startedAt: string;
  completedAt?: string;
  checklist: Record<string, boolean>;
  history: HistoryEntry[];
  subPhases: SubPhases;
  taskSize: TaskSize;
  scope?: { affectedFiles: string[]; affectedDirs: string[] };
  testBaseline?: TestBaseline;
  testResults?: TestResult[];
  knownBugs?: KnownBug[];
  resetHistory?: ResetHistoryEntry[];
}
```

### 暗号署名: **なし** (プレーンJSON)

## 6. 既存テストファイル (13ファイル)

- next.test.ts, next-artifact-check.test.ts, next-scope-check.test.ts
- start.test.ts, back.test.ts, parallel-tasks.test.ts
- complete-sub-artifact-check.test.ts
- scope.test.ts, set-scope-enhanced.test.ts, set-scope-expanded.test.ts
- test-result.test.ts, record-test-result-output.test.ts, record-test-result-enhanced.test.ts

## 7. 修正対象ファイル一覧

### 優先度1: セキュリティ根本修正
1. `hooks/enforce-workflow.js` - FAIL_OPEN除去
2. `hooks/phase-edit-guard.js` - FAIL_OPEN除去、Bashパターン強化
3. `hooks/block-dangerous-commands.js` - FAIL_OPEN除去
4. `mcp-server/src/state/manager.ts` - 状態ファイル署名追加
5. `mcp-server/src/state/types.ts` - 署名フィールド追加

### 優先度2: スコープ・検証強化
6. `mcp-server/src/tools/next.ts` - スコープサイズ制限追加
7. `mcp-server/src/tools/set-scope.ts` - スコープ上限チェック
8. `mcp-server/src/validation/design-validator.ts` - AST検証強化

### 優先度3: フェーズガイダンス強化
9. `workflow-phases/research.md` - 依存グラフ要求追加
10. `workflow-phases/implementation.md` - Wave実装ガイダンス
