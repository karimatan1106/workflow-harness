# ワークフロー並列タスク対応 - 調査結果

## 概要

現在のワークフローシステムは「単一アクティブタスク」設計になっており、複数タスクの並列処理に不向き。グローバル状態でアクティブタスクを管理する必要性を検証し、並列タスク対応の設計を行う。

## 現在のアーキテクチャ

### 状態管理構造

```
.claude/state/
├── workflow-state.json          # グローバル状態（GlobalState）
└── workflows/
    ├── {taskId}_タスクA/
    │   └── workflow-state.json  # タスク状態（TaskState）
    └── {taskId}_タスクB/
        └── workflow-state.json  # タスク状態（TaskState）
```

### GlobalState（問題のある設計）

```typescript
// mcp-server/src/state/types.ts:192-201
interface GlobalState {
  phase: PhaseName;              // ← activeTasks[0]のフェーズ（冗長）
  activeTasks: ActiveTask[];     // ← 先頭がカレント（問題の根源）
  history: HistoryEntry[];
  checklist: Record<string, boolean>;
}
```

### TaskState（自己完結）

```typescript
// mcp-server/src/state/types.ts:136-161
interface TaskState {
  phase: PhaseName;
  taskId: string;
  taskName: string;
  workflowDir: string;
  docsDir?: string;
  startedAt: string;
  completedAt?: string;
  checklist: Record<string, boolean>;
  history: HistoryEntry[];
  subPhases: SubPhases;
  resetHistory?: ResetHistoryEntry[];
  taskSize?: TaskSize;
}
```

## 影響範囲の分析

### MCPサーバー（ツール）

| ファイル | 問題箇所 | 変更内容 |
|---------|---------|---------|
| `state/manager.ts:228-234` | `getCurrentTask()` が `activeTasks[0]` を返す | 削除または `taskId` 指定に変更 |
| `state/manager.ts:364-379` | `addTaskToGlobalState()` | グローバル登録を削除 |
| `state/manager.ts:514-527` | `switchTask()` | **廃止** |
| `tools/helpers.ts:23-34` | `getCurrentTaskOrError()` | `taskId` 必須化 |
| `tools/helpers.ts:43-60` | `getTaskStateOrError()` | `taskId` 必須化 |
| `tools/status.ts:18-75` | `workflowStatus()` | `taskId` オプション（省略時は全タスク一覧） |
| `tools/next.ts:27-93` | `workflowNext()` | `taskId` 必須化 |
| `tools/approve.ts:21-67` | `workflowApprove()` | `taskId` 必須化 |
| `tools/reset.ts:20-43` | `workflowReset()` | `taskId` 必須化 |
| `tools/complete-sub.ts:22-86` | `workflowCompleteSub()` | `taskId` 必須化 |
| `tools/list.ts:17-44` | `workflowList()` | ディレクトリスキャンに変更 |
| `tools/switch.ts` | 全体 | **廃止** |
| `server.ts:47-56` | `TOOL_DEFINITIONS` | `switchToolDefinition` 削除 |

### Hooks

| ファイル | 問題箇所 | 変更内容 |
|---------|---------|---------|
| `hooks/enforce-workflow.js:267-278` | `activeTasks[0]` をカレントとして使用 | ファイルパスからタスク推論 |
| `hooks/phase-edit-guard.js:504-518` | `findActiveWorkflowTask()` が `activeTasks[0]` を返す | ファイルパスからタスク推論 |

## 新設計案

### グローバル状態の簡素化

```typescript
// 新しいGlobalState（最小限）
interface GlobalState {
  history: HistoryEntry[];        // 全体履歴（残すか検討）
  // activeTasks: 削除
  // phase: 削除
  // checklist: 削除（各タスクに持たせる）
}
```

または、**グローバル状態ファイル自体を廃止**し、タスク発見はディレクトリスキャンで行う。

### タスク発見メカニズム

```typescript
// ディレクトリスキャンによるタスク一覧取得
function discoverTasks(): TaskState[] {
  const workflowsDir = '.claude/state/workflows';
  const taskDirs = fs.readdirSync(workflowsDir);

  return taskDirs
    .map(dir => readTaskState(path.join(workflowsDir, dir)))
    .filter(state => state !== null && state.phase !== 'completed');
}
```

### ファイルパスからタスク推論

```typescript
function findTaskByFilePath(filePath: string): TaskState | null {
  const tasks = discoverTasks();

  for (const task of tasks) {
    // docsDir 配下のファイル
    if (task.docsDir && filePath.startsWith(task.docsDir)) {
      return task;
    }
    // workflowDir 配下のファイル
    if (filePath.startsWith(task.workflowDir)) {
      return task;
    }
  }

  return null; // どのタスクにも属さない
}
```

### ツールAPIの変更

| ツール | 現在 | 変更後 |
|--------|-----|-------|
| `workflow_status` | 引数なし → `activeTasks[0]` | `taskId?` → 指定タスク or 全タスク一覧 |
| `workflow_next` | 引数なし → `activeTasks[0]` | `taskId` 必須 |
| `workflow_approve` | `type` のみ | `taskId` + `type` |
| `workflow_reset` | `reason?` のみ | `taskId` + `reason?` |
| `workflow_complete_sub` | `subPhase` のみ | `taskId` + `subPhase` |
| `workflow_list` | グローバル状態から取得 | ディレクトリスキャン |
| `workflow_switch` | タスク切り替え | **廃止** |

## リスクと考慮事項

### 後方互換性

- 既存タスクの `workflow-state.json` は変更不要（TaskStateはそのまま）
- グローバル状態ファイルのマイグレーションが必要
- ツールのパラメータ変更により、既存のスキル定義の更新が必要

### パフォーマンス

- ディレクトリスキャンは毎回発生するが、タスク数は通常少ない
- キャッシュは不要（状態の整合性を優先）

### hookの変更

- ファイルパスからタスクを推論できない場合の挙動を決める必要がある
  - 案1: どのタスクにも属さない場合は許可（緩和）
  - 案2: どのタスクにも属さない場合はブロック（厳格）
  - **推奨: 案1**（並列タスク対応の目的から）

## 結論

グローバルでのアクティブタスク管理は不要。各タスクは自己完結しており、必要な情報は全て `TaskState` に含まれている。

変更の主な方針:
1. `GlobalState.activeTasks` を廃止
2. タスク発見はディレクトリスキャンで行う
3. 全ツールに `taskId` パラメータを追加（必須またはオプション）
4. `workflow_switch` を廃止
5. hookはファイルパスからタスクを推論
