# ワークフロー並列タスク対応 - テスト設計

## テスト方針

### テストレベル

| レベル | 対象 | ツール |
|--------|------|--------|
| ユニットテスト | StateManager, 各ツール関数 | Vitest |
| 統合テスト | MCPサーバー全体 | Vitest + モック |
| E2Eテスト | Hook + ツール連携 | 手動確認 |

### テストカバレッジ目標

- ユニットテスト: 80%以上
- 統合テスト: 主要フロー100%

## テストケース

### TC-1: StateManager.discoverTasks()

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-1.1 | workflowsディレクトリが空 | 空配列を返す |
| TC-1.2 | 1つのアクティブタスクが存在 | 1要素の配列を返す |
| TC-1.3 | 複数のアクティブタスクが存在 | 全タスクを含む配列を返す |
| TC-1.4 | completedタスクが混在 | completedを除外した配列を返す |
| TC-1.5 | workflowsディレクトリが存在しない | 空配列を返す |
| TC-1.6 | 不正なworkflow-state.jsonがある | そのタスクをスキップ |

### TC-2: StateManager.getTaskById()

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-2.1 | 存在するtaskIdを指定 | TaskStateを返す |
| TC-2.2 | 存在しないtaskIdを指定 | nullを返す |
| TC-2.3 | completedタスクのtaskIdを指定 | nullを返す（アクティブのみ） |

### TC-3: workflow_status

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-3.1 | taskId省略、タスクなし | success: true, tasks: [] |
| TC-3.2 | taskId省略、タスクあり | success: true, tasks: [...] |
| TC-3.3 | taskId指定、存在する | success: true, 詳細情報 |
| TC-3.4 | taskId指定、存在しない | success: false, TASK_NOT_FOUND |

### TC-4: workflow_next

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-4.1 | taskId省略 | success: false, TASK_ID_REQUIRED |
| TC-4.2 | taskId指定、存在する | success: true, フェーズ遷移 |
| TC-4.3 | taskId指定、存在しない | success: false, TASK_NOT_FOUND |
| TC-4.4 | 並列フェーズで未完了サブフェーズあり | success: false, エラー |

### TC-5: workflow_approve

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-5.1 | taskId省略 | success: false, TASK_ID_REQUIRED |
| TC-5.2 | taskId指定、design_reviewフェーズ | success: true, 承認 |
| TC-5.3 | taskId指定、他のフェーズ | success: false, エラー |

### TC-6: workflow_reset

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-6.1 | taskId省略 | success: false, TASK_ID_REQUIRED |
| TC-6.2 | taskId指定、理由あり | success: true, researchにリセット |
| TC-6.3 | taskId指定、理由なし | success: true, researchにリセット |

### TC-7: workflow_complete_sub

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-7.1 | taskId省略 | success: false, TASK_ID_REQUIRED |
| TC-7.2 | taskId指定、有効なサブフェーズ | success: true, 完了マーク |
| TC-7.3 | taskId指定、無効なサブフェーズ | success: false, エラー |
| TC-7.4 | 全サブフェーズ完了後 | allCompleted: true |

### TC-8: workflow_list

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-8.1 | タスクなし | success: true, tasks: [] |
| TC-8.2 | タスクあり | success: true, 全タスク一覧 |

### TC-9: ファイルパス推論（Hooks）

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-9.1 | docsDir配下のファイル | 該当タスクを返す |
| TC-9.2 | workflowDir配下のファイル | 該当タスクを返す |
| TC-9.3 | どのタスクにも属さない | nullを返す |
| TC-9.4 | 複数タスクにマッチ（ネスト） | 最長一致のタスクを返す |

### TC-10: 並列タスク処理（統合）

| ID | シナリオ | 期待結果 |
|----|----------|----------|
| TC-10.1 | タスクA作業中にタスクBのstatus確認 | タスクAの作業が継続可能 |
| TC-10.2 | タスクAとタスクBを交互にnext | 各タスクが独立して遷移 |
| TC-10.3 | タスクAのdocs編集中にタスクBのdocs編集 | 両方許可される |

## テストデータ

### モックタスク状態

```typescript
const mockTaskA: TaskState = {
  taskId: "20260125_100000",
  taskName: "タスクA",
  phase: "research",
  workflowDir: ".claude/state/workflows/20260125_100000_タスクA/",
  docsDir: "docs/workflows/タスクA/",
  startedAt: "2026-01-25T10:00:00.000Z",
  checklist: {},
  history: [],
  subPhases: {}
};

const mockTaskB: TaskState = {
  taskId: "20260125_110000",
  taskName: "タスクB",
  phase: "implementation",
  workflowDir: ".claude/state/workflows/20260125_110000_タスクB/",
  docsDir: "docs/workflows/タスクB/",
  startedAt: "2026-01-25T11:00:00.000Z",
  checklist: {},
  history: [],
  subPhases: {}
};
```

## テスト環境

### セットアップ

```typescript
beforeEach(() => {
  // テスト用の一時ディレクトリを作成
  // モックファイルシステムをセットアップ
});

afterEach(() => {
  // クリーンアップ
});
```

### ファイルシステムモック

```typescript
import { vol } from 'memfs';

vol.fromJSON({
  '.claude/state/workflows/20260125_100000_タスクA/workflow-state.json':
    JSON.stringify(mockTaskA),
  '.claude/state/workflows/20260125_110000_タスクB/workflow-state.json':
    JSON.stringify(mockTaskB)
});
```

## 受け入れテスト

### AT-1: 並列タスク処理

```
Given: タスクAとタスクBが並行して存在する
When: タスクAで作業中にタスクBのstatusを確認する
Then: タスクAの作業がブロックされない
```

### AT-2: タスク指定操作

```
Given: タスクAとタスクBが存在する
When: workflow_next(taskId: "A")を実行する
Then: タスクAのみがフェーズ遷移する
And: タスクBは影響を受けない
```

### AT-3: hookのファイルパス推論

```
Given: タスクAのdocsDirが "docs/workflows/タスクA/"
When: "docs/workflows/タスクA/research.md" を編集しようとする
Then: タスクAのフェーズルールが適用される
```
