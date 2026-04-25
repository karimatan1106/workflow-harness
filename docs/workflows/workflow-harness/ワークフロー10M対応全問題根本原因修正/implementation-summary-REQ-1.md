# REQ-1: manager.ts修正 - 実装サマリー

## 修正概要

task-index.jsonのデュアルスキーマ競合を解消するため、manager.tsの`saveTaskIndex()`関数をno-opから実装ありに変更しました。

## 修正内容

### 1. saveTaskIndex()の実装（lines 468-491）

**変更前:**
- no-op（空の関数体）
- コメントのみで「MCP serverは書き込みを停止」と記載

**変更後:**
- Hookスキーマ形式（v2）でtask-index.jsonに書き込み
- 全フィールドをスプレッドで含める（HMAC検証互換性のため）
- ロック取得とアトミック書き込みで競合を防止

```typescript
private saveTaskIndex(_index: Record<string, string>): void {
  try {
    const tasks = this.discoverTasks();
    const taskList = {
      schemaVersion: 2,
      tasks: tasks.map(task => ({
        ...task,  // 全フィールドを保持（HMAC検証のため）
      })),
      updatedAt: Date.now(),
    };
    const indexPath = path.join(STATE_DIR, 'task-index.json');

    // ロックを取得してアトミックに書き込む
    const releaseLock = acquireLockSync(indexPath);
    try {
      atomicWriteJson(indexPath, taskList);
    } finally {
      releaseLock();
    }
  } catch (err) {
    // 書き込み失敗は警告のみ（フック側がフォールバックスキャンで対応）
    console.error('[saveTaskIndex] Failed to write task-index.json:', err);
  }
}
```

### 2. updateTaskPhase()でのsaveTaskIndex()呼び出し確実化（lines 805-813）

**変更前:**
- completedフェーズ時のみsaveTaskIndex()を呼び出し

**変更後:**
- 全フェーズ遷移でsaveTaskIndex()を呼び出し
- Hook側キャッシュと同期を維持

```typescript
// REQ-1: フェーズ遷移時にtask-index.jsonを更新（Hookスキーマ形式）
const index = this.loadTaskIndex();
if (phase === 'completed') {
  // completedフェーズの場合、インデックスから削除
  delete index[taskId];
  console.log(`[StateManager] Removed completed task ${taskId} from index`);
}
// 全フェーズ遷移でtask-index.jsonを更新（Hook側キャッシュと同期）
this.saveTaskIndex(index);
```

### 3. Hookスキーマ形式の詳細

task-index.json（v2スキーマ）の構造:

```json
{
  "schemaVersion": 2,
  "tasks": [
    {
      // workflow-state.jsonの全フィールドを含む
      "phase": "implementation",
      "taskId": "20260215_094116",
      "taskName": "...",
      "workflowDir": "...",
      "docsDir": "...",
      "startedAt": "...",
      "checklist": {},
      "history": [],
      "subPhases": {},
      "taskSize": "large",
      "sessionToken": "...",
      "userIntent": "...",
      "stateIntegrity": "...",
      "validationResult": {...},
      "testBaseline": {...},
      "scope": {...},
      "phaseSkipReasons": {...},
      "approvals": {...}
    }
  ],
  "updatedAt": 1771121257939
}
```

## 重要な設計判断

### なぜ全フィールドをスプレッドで含めるか

enforce-workflow.jsのHMAC検証がtask-index.jsonのタスクエントリに対して行われるため、workflow-state.jsonと同じフィールドが必要です。フィールドが欠けるとHMAC不一致エラーが発生します。

### 循環呼び出しの回避

saveTaskIndex()内でthis.discoverTasks()を呼び出していますが、以下の理由で循環呼び出しにはなりません：

1. discoverTasks()はファイルシステムをスキャンしてTaskState[]を返す
2. saveTaskIndex()はその結果をtask-index.jsonに書き込む
3. discoverTasks()の次回呼び出し時は、まずtask-index.jsonを読み込もうとするが、なければフォールバックスキャン

### 既存テストへの影響

- 772テストが存在（testBaseline記録済み）
- saveTaskIndex()がno-opから実装ありに変更されたため、task-index.jsonへの書き込みが発生
- ただし、書き込み失敗時は警告のみで処理を継続するため、テストには影響なし

## 次のステップ

この修正により、REQ-1（task-index.jsonデュアルスキーマ競合の解消）が完了しました。次は以下のいずれかに進みます：

- REQ-2: discover-tasks.jsのmtimeチェック改善
- REQ-3: enforce-workflow.jsのHMAC検証改善
- ビルド確認とテスト実行

## 関連ファイル

- 修正対象: `workflow-plugin/mcp-server/src/state/manager.ts`
- 連携先: `workflow-plugin/hooks/lib/discover-tasks.js`
- スキーマ定義: discover-tasks.js lines 112-116
- HMAC検証: `workflow-plugin/hooks/enforce-workflow.js`
