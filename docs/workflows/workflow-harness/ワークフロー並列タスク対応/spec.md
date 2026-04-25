# ワークフロー並列タスク対応 - 仕様書

## 概要

グローバルでのアクティブタスク管理を廃止し、各タスクを独立・自己完結させる。

## アーキテクチャ変更

### Before（現状）

```
GlobalState (workflow-state.json)
├── phase: "research"              # activeTasks[0]のフェーズ
├── activeTasks: [                 # 先頭がカレント
│   { taskId: "A", phase: "research", workflowDir: "..." },
│   { taskId: "B", phase: "implementation", workflowDir: "..." }
│ ]
├── history: [...]
└── checklist: {...}

↓ hooks/toolsは activeTasks[0] を参照
```

### After（新設計）

```
GlobalState (workflow-state.json) - **廃止**
（グローバル状態ファイル自体が不要になる）

TaskState (.claude/state/workflows/{taskId}_{name}/workflow-state.json)
├── phase: "research"
├── taskId: "20260125_123456"
├── taskName: "タスク名"
├── workflowDir: ".claude/state/workflows/..."
├── docsDir: "docs/workflows/..."
├── startedAt: "2026-01-25T00:00:00.000Z"
├── checklist: {...}
├── history: [...]
├── subPhases: {...}
└── taskSize: "large"

↓ hooks/toolsはファイルパスまたはtaskIdでタスクを特定
```

## 型定義の変更

### GlobalState（廃止）

```typescript
// Before
interface GlobalState {
  phase: PhaseName;
  activeTasks: ActiveTask[];
  history: HistoryEntry[];
  checklist: Record<string, boolean>;
}

// After
// GlobalState型自体を廃止
// グローバル状態ファイル (.claude/state/workflow-state.json) も不要
// 各タスクはTaskStateで完全に自己完結
```

### ActiveTask（廃止）

```typescript
// Before
interface ActiveTask {
  taskId: string;
  taskName: string;
  workflowDir: string;
  phase: PhaseName;
  taskSize?: TaskSize;
}

// After
// ActiveTask型を廃止
// TaskStateがその役割を担う
```

## ツールAPI変更

### workflow_status

```typescript
// Before
workflow_status(): StatusResult

// After
workflow_status(taskId?: string): StatusResult

// taskId省略時: 全アクティブタスク一覧
// taskId指定時: 指定タスクの詳細
```

**レスポンス（taskId省略時）**:
```json
{
  "success": true,
  "status": "active",
  "tasks": [
    { "taskId": "A", "taskName": "タスクA", "phase": "research", "docsDir": "..." },
    { "taskId": "B", "taskName": "タスクB", "phase": "implementation", "docsDir": "..." }
  ],
  "message": "2件のアクティブタスクがあります"
}
```

**レスポンス（taskId指定時）**:
```json
{
  "success": true,
  "status": "active",
  "taskId": "A",
  "taskName": "タスクA",
  "phase": "research",
  "workflowDir": "...",
  "docsDir": "...",
  "subPhases": { ... },
  "message": "調査フェーズ - 要件分析・既存コード調査"
}
```

### workflow_next

```typescript
// Before
workflow_next(): NextResult

// After
workflow_next(taskId: string): NextResult  // taskId必須
```

### workflow_approve

```typescript
// Before
workflow_approve(type: string): ApproveResult

// After
workflow_approve(taskId: string, type: string): ApproveResult  // taskId必須
```

### workflow_reset

```typescript
// Before
workflow_reset(reason?: string): ResetResult

// After
workflow_reset(taskId: string, reason?: string): ResetResult  // taskId必須
```

### workflow_complete_sub

```typescript
// Before
workflow_complete_sub(subPhase: string): CompleteSubResult

// After
workflow_complete_sub(taskId: string, subPhase: string): CompleteSubResult  // taskId必須
```

### workflow_list

```typescript
// Before: GlobalState.activeTasksから取得
// After: ディレクトリスキャンで取得

workflow_list(): ListResult  // 引数変更なし
```

### workflow_switch（廃止）

```typescript
// この関数を削除
// workflow_switch(taskId: string): SwitchResult
```

## StateManager変更

### 新規メソッド: discoverTasks()

```typescript
/**
 * ディレクトリスキャンでアクティブタスクを発見
 * @returns 完了していないタスクの配列
 */
discoverTasks(): TaskState[] {
  const workflowsDir = this.workflowDir;
  if (!fs.existsSync(workflowsDir)) return [];

  return fs.readdirSync(workflowsDir)
    .filter(name => fs.statSync(path.join(workflowsDir, name)).isDirectory())
    .map(name => this.readTaskState(path.join(workflowsDir, name)))
    .filter((state): state is TaskState =>
      state !== null && state.phase !== 'completed'
    );
}
```

### 新規メソッド: getTaskById()

```typescript
/**
 * taskIdでタスクを取得
 * @param taskId タスクID
 * @returns タスク状態、または存在しない場合はnull
 */
getTaskById(taskId: string): TaskState | null {
  const tasks = this.discoverTasks();
  return tasks.find(t => t.taskId === taskId) ?? null;
}
```

### 削除メソッド

- `getCurrentTask()` - 廃止
- `switchTask()` - 廃止
- `addTaskToGlobalState()` - 廃止（または内部で空操作）

### 変更メソッド

- `createTask()` - グローバル状態への登録を削除
- `completeTask()` - グローバル状態からの削除を削除
- `updateTaskPhase()` - グローバル状態の更新を削除

## Hooks変更

### ファイルパス推論ロジック

```javascript
/**
 * ファイルパスからタスクを推論
 * @param {string} filePath 編集対象ファイルパス
 * @returns {TaskState|null} マッチしたタスク、またはnull
 */
function findTaskByFilePath(filePath) {
  const tasks = discoverTasks();
  let bestMatch = null;
  let bestMatchLength = 0;

  for (const task of tasks) {
    // docsDir チェック（最長一致）
    if (task.docsDir && filePath.startsWith(task.docsDir)) {
      if (task.docsDir.length > bestMatchLength) {
        bestMatch = task;
        bestMatchLength = task.docsDir.length;
      }
    }
    // workflowDir チェック（最長一致）
    if (filePath.startsWith(task.workflowDir)) {
      if (task.workflowDir.length > bestMatchLength) {
        bestMatch = task;
        bestMatchLength = task.workflowDir.length;
      }
    }
  }

  return bestMatch;
}
```

### enforce-workflow.js 変更

```javascript
// Before
const currentTask = activeTasks[0];

// After
const task = findTaskByFilePath(filePath);
if (!task) {
  // どのタスクにも属さないファイル → 許可（緩和方針）
  process.exit(0);
}
```

### phase-edit-guard.js 変更

```javascript
// Before
function findActiveWorkflowTask() {
  return globalState.activeTasks[0] || null;
}

// After
function findActiveWorkflowTask(filePath) {
  return findTaskByFilePath(filePath);
}
```

## エラーメッセージ

### 新規エラー

| コード | メッセージ |
|-------|----------|
| TASK_ID_REQUIRED | taskIdは必須です |
| TASK_NOT_FOUND | 指定されたタスクが見つかりません: {taskId} |

## 変更ファイル一覧

### MCPサーバー

| ファイル | 変更種別 |
|---------|---------|
| `state/types.ts` | GlobalState型・ActiveTask型を**廃止** |
| `state/manager.ts` | discoverTasks追加、getCurrentTask削除、switchTask削除 |
| `tools/status.ts` | taskIdパラメータ追加、レスポンス形式変更 |
| `tools/next.ts` | taskIdパラメータ追加（必須） |
| `tools/approve.ts` | taskIdパラメータ追加（必須） |
| `tools/reset.ts` | taskIdパラメータ追加（必須） |
| `tools/complete-sub.ts` | taskIdパラメータ追加（必須） |
| `tools/list.ts` | ディレクトリスキャン実装 |
| `tools/switch.ts` | **削除** |
| `tools/helpers.ts` | getCurrentTaskOrError削除、getTaskByIdOrError追加 |
| `tools/index.ts` | switchエクスポート削除 |
| `server.ts` | switchToolDefinition削除 |

### Hooks

| ファイル | 変更種別 |
|---------|---------|
| `hooks/enforce-workflow.js` | ファイルパス推論ロジック追加 |
| `hooks/phase-edit-guard.js` | ファイルパス推論ロジック追加 |

## マイグレーション

1. GlobalStateファイルの `activeTasks` は無視される（削除は不要）
2. 既存TaskStateは変更なし
3. 新しいツール呼び出しでは `taskId` が必須になる

## テスト観点

1. ディレクトリスキャンでタスク一覧が正しく取得できる
2. taskId指定で正しいタスクが操作される
3. ファイルパスから正しいタスクが推論される
4. 複数タスク並列時に相互干渉がない
5. 存在しないtaskIdでエラーが返される
6. どのタスクにも属さないファイルが許可される
