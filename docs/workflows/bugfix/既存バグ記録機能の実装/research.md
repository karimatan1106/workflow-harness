# 既存バグ記録機能の実装 - 調査結果

## 概要

テスト失敗時に「既存バグだから削除」ではなく、適切に記録・追跡する仕組みを実装する。

## 1. 既存のテスト追跡機能

### 現在の実装

| ツール | 機能 | 使用フェーズ |
|--------|------|-------------|
| `workflowRecordTest` | テストファイル記録 | test_impl |
| `workflowCaptureBaseline` | ベースライン記録 | research |
| `workflowGetTestInfo` | 情報取得 | 任意 |

### TaskState構造

```typescript
interface TaskState {
  // ...既存フィールド
  testFiles?: string[];           // test_implで作成したテストファイル
  testBaseline?: TestBaseline;    // researchで記録したベースライン
}

interface TestBaseline {
  capturedAt: string;
  failedTests: string[];
  totalTests: number;
  passedTests: number;
}
```

### 課題

- ベースラインは「失敗テスト名」のみ記録
- 「なぜ失敗しているか」「いつ修正するか」の情報がない
- テスト削除を防ぐ仕組みがない

## 2. フック機能

### 既存フック一覧

| フック | トリガー | 役割 |
|--------|---------|------|
| `phase-edit-guard.js` | PreToolUse | フェーズ別編集制限 |
| `block-dangerous-commands.js` | PreToolUse | 危険コマンドブロック |
| `loop-detector.js` | PostToolUse | 無限ループ検出 |
| `enforce-workflow.js` | 全ツール | ワークフロー強制 |

### テストファイル削除検出

`phase-edit-guard.js` の `analyzeBashCommand()` で以下を検出可能：
- `rm` コマンドでの削除
- ファイルパターンマッチング

**拡張案**: テストファイル（`.test.ts`, `.spec.ts`）の削除時に警告/ブロック

## 3. 実装方針

### 3.1 新MCPツール: `workflow_record_known_bug`

```typescript
interface KnownBug {
  bugId: string;                    // バグID（例: BUG-001）
  testName: string;                 // 失敗するテスト名
  description: string;              // バグの説明
  reason: string;                   // 既知バグと判断した理由
  severity: 'low' | 'medium' | 'high' | 'critical';
  issueUrl?: string;                // 関連Issue URL
  targetPhase: 'next_sprint' | 'backlog' | 'deferred';
  recordedAt: string;
}
```

**使用フェーズ**: regression_test（リグレッションテスト時のみ）

### 3.2 TaskState拡張

```typescript
interface TaskState {
  // ...既存フィールド
  knownBugs?: KnownBug[];          // 既知バグ一覧
}
```

### 3.3 テストファイル削除防止フック

`phase-edit-guard.js` を拡張：

```javascript
// テストファイル削除の検出
if (isDeleteCommand && isTestFile(targetPath)) {
  // regression_testフェーズ以外では警告
  // 削除ではなくskip化を推奨
}
```

### 3.4 フロー

```
regression_test フェーズ
    ↓
テスト失敗を検出（ベースラインにない新規失敗）
    ↓
今回の変更が原因？
    ├── YES → 実装を修正
    └── NO → 既存バグと判断
              ↓
         workflow_record_known_bug で記録
              - バグID
              - 説明
              - 深刻度
              - 対応予定
              ↓
         テストは削除せず skip + TODO
              ↓
         別タスクで修正
```

## 4. Issue連携

### 現状

- MCPサーバーはツール定義のみ
- GitHub API連携は実装されていない

### 提案

- `issueUrl` フィールドで参照関係を手動管理
- 自動Issue作成は将来の拡張として分離

## 5. 実装スコープ

### 今回実装するもの

1. `workflow_record_known_bug` MCPツール
2. `workflow_get_known_bugs` MCPツール（一覧取得）
3. TaskStateに `knownBugs` フィールド追加
4. テストファイル削除時の警告メッセージ強化

### 将来の拡張（別タスク）

- GitHub Issue自動作成連携
- バグ修正完了時の自動クローズ
- 深刻度に基づくワークフロー制御

## 関連ファイル

- `mcp-server/src/tools/test-tracking.ts`
- `mcp-server/src/state/types.ts`
- `hooks/phase-edit-guard.js`
- `mcp-server/src/server.ts`
