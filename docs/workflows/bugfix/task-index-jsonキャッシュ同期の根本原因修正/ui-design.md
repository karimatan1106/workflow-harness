# UIインターフェース設計: task-index.jsonキャッシュ同期の根本原因修正

## サマリー

本ドキュメントはバックエンドキャッシュ同期修正タスクにおけるCLIインターフェース、エラーメッセージ、APIレスポンス、設定ファイルの設計を定義します。
グラフィカルUIは存在しませんが、開発者が操作するワークフローMCPツールのコマンドインターフェースと、hookがブロックする際のエラーメッセージはユーザー体験の重要な要素です。
task-index.jsonのスキーマ設計により、キャッシュデータの構造を明確化し、将来的な拡張性を確保します。
MCP serverのAPIレスポンス形式を標準化することで、フロントエンド側でのエラーハンドリングが容易になります。
本設計により、ワークフロープラグインのCLI体験が向上し、開発者がキャッシュ同期問題に遭遇した際の問題診断が容易になります。

## CLIインターフェース設計

ワークフローMCPツールは開発者がClaude Codeセッション内で操作するコマンドラインインターフェースを提供します。
本タスクではキャッシュ同期問題の診断と対処のため、既存ツールの挙動を改善し、新規診断コマンドを追加します。
全てのコマンドはJSON-RPCプロトコル経由でMCP serverに送信され、結果はstructured outputとして返されます。

### workflow_status: 現在のタスク状態取得

このツールはtask-index.jsonとworkflow-state.jsonの両方を読み取り、整合性を検証します。
taskIdパラメータを省略した場合は全アクティブタスクの一覧を返却し、指定した場合は該当タスクの詳細情報を返却します。
本修正により、レスポンスにキャッシュ整合性フィールド(cacheConsistency)が追加され、task-index.jsonとworkflow-state.jsonのphaseが一致しているかを明示します。

```typescript
// 呼び出し例
mcp__workflow__workflow_status({ taskId: "20260215_123456_..." })

// 正常レスポンス（キャッシュ整合性OK）
{
  "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
  "taskName": "task-index-jsonキャッシュ同期の根本原因修正",
  "phase": "ui_design",
  "cacheConsistency": "OK",
  "details": {
    "taskIndexPhase": "ui_design",
    "workflowStatePhase": "ui_design",
    "lastUpdated": "2026-02-15T10:30:45.123Z"
  }
}

// 異常レスポンス（キャッシュ不整合）
{
  "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
  "taskName": "task-index-jsonキャッシュ同期の根本原因修正",
  "phase": "commit",
  "cacheConsistency": "MISMATCH",
  "details": {
    "taskIndexPhase": "implementation",
    "workflowStatePhase": "commit",
    "warning": "task-index.json contains stale phase information",
    "recommendation": "Restart MCP server or set TASK_INDEX_TTL_MS=0"
  }
}
```

このレスポンス拡張により、開発者は `workflow_status` を呼び出すだけでキャッシュ不整合を即座に検出できます。

### workflow_next: 次フェーズへの遷移

このツールはフェーズ遷移を実行し、内部でupdateTaskPhase()を呼び出してtask-index.jsonを更新します。
本修正により、updateTaskIndexForSingleTask()メソッドが使用され、キャッシュ競合が発生しなくなります。
レスポンスにはフェーズ遷移の成功確認とtask-index.json更新完了のタイムスタンプが含まれます。

```typescript
// 呼び出し例
mcp__workflow__workflow_next({ taskId: "20260215_123456_..." })

// 正常レスポンス
{
  "success": true,
  "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
  "previousPhase": "ui_design",
  "currentPhase": "design_review",
  "taskIndexUpdated": true,
  "timestamp": "2026-02-15T10:35:12.456Z"
}
```

taskIndexUpdatedフィールドによりtask-index.jsonの更新が完了したことを明示的に保証します。

### 環境変数によるキャッシュTTLオーバーライド

discover-tasks.jsのキャッシュTTLは環境変数TASK_INDEX_TTL_MSでオーバーライド可能です。
開発中やデバッグ時はキャッシュを無効化(0ms)することで、常に最新のtask-index.jsonが読み込まれます。
本修正後はデフォルトTTLのままでも問題は発生しませんが、診断のためオーバーライド機能の存在を文書化します。

```bash
# キャッシュを無効化してMCP serverを起動
TASK_INDEX_TTL_MS=0 node workflow-plugin/mcp-server/dist/index.js

# 短いTTL（5秒）に設定
TASK_INDEX_TTL_MS=5000 node workflow-plugin/mcp-server/dist/index.js
```

この設定により、キャッシュ関連の問題が疑われる場合の診断が容易になります。

## エラーメッセージ設計

hookがBashコマンドをブロックする際のエラーメッセージは、開発者が問題を理解し適切に対処するための重要な情報源です。
本修正により、キャッシュ同期問題に起因するブロックが発生した際のエラーメッセージが改善されます。
phase-edit-guard.jsのB-2チェック順序修正により、commitフェーズでのgit addブロックは発生しなくなりますが、防御的なエラーメッセージも改善します。

### 修正前のエラーメッセージ（問題のあるケース）

commitフェーズでgit addを実行した際に、task-index.jsonが古い"implementation"を返すとbash-whitelistチェックで以下のエラーが表示されました。

```
❌ [Phase Edit Guard] BLOCKED: Bash command not allowed in current phase

Command: git add .
Current phase: implementation
Reason: 'git add' is not in the whitelist for implementation phase

Allowed commands in implementation phase:
  readonly: ls, pwd, cat, head, tail, grep, find, wc, git status, git log, git diff, git show, npm list, node --version, npm --version
  testing: npm test, npm run test, npx vitest, npx jest, npx playwright test, pytest

💡 Tip: If you are ready to commit, use `/workflow next` to move to commit phase.
```

このメッセージは"implementation"フェーズと表示されているため、開発者はフェーズが遷移していないと誤解します。
実際にはworkflow-state.jsonは"commit"フェーズに遷移済みで、task-index.jsonのキャッシュが古いだけです。
開発者は `/workflow next` を再度実行しようとしてエラーになり、混乱します。

### 修正後のエラーメッセージ（改善版）

B-2チェック順序の修正により、commitフェーズのgit操作は優先的に許可されるため、このエラーは発生しなくなります。
ただし、万が一キャッシュ不整合が検出された場合は以下のような診断情報を含むエラーメッセージを表示します。

```
⚠️  [Phase Edit Guard] WARNING: Phase information mismatch detected

task-index.json reports: implementation
workflow-state.json reports: commit

This may indicate a cache synchronization issue.

Recommended actions:
  1. Run `workflow_status` to verify current phase
  2. Restart MCP server to clear cache
  3. Set TASK_INDEX_TTL_MS=0 environment variable

If workflow-state.json shows commit phase, this command should be allowed.
Proceeding with commit phase permissions...

✅ Command allowed: git add .
```

この改善により、開発者はキャッシュ不整合の発生を認識しつつも作業を継続できます。

### B-2チェックの許可メッセージ

commitまたはpushフェーズで適切にgit操作が許可された場合は以下のメッセージを表示します。

```
✅ [Phase Edit Guard] Command allowed: git add .
Reason: commit/push phase - git operations are permitted
Phase: commit
```

簡潔で明確なメッセージにより、開発者は正常に動作していることを確認できます。

### B-2チェックのブロックメッセージ

commitフェーズでgit以外の危険なコマンドを実行しようとした場合は明確にブロックします。

```
❌ [Phase Edit Guard] BLOCKED: Dangerous file operation in commit phase

Command: rm -rf src/
Current phase: commit
Reason: File deletion commands are not allowed in commit phase

commit phase only permits:
  - git commands (add, commit, status, log, diff, show)
  - readonly commands (ls, cat, grep, etc.)

💡 To modify files, use `/workflow back implementation` to return to implementation phase.
```

このメッセージにより、開発者は誤って破壊的操作を実行することを防げます。

## APIレスポンス設計

MCP serverが返却するJSONレスポンスの標準形式を定義します。
全てのワークフローツールは統一されたレスポンス構造を返却し、エラーハンドリングを容易にします。
フロントエンド（Claude Code UI）はこのレスポンス形式に基づいてエラー表示やステータス更新を行います。

### 成功レスポンスの標準形式

全ての成功レスポンスは以下の構造を持ちます。

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata: {
    timestamp: string; // ISO 8601形式
    taskId?: string;
    phase?: string;
  };
}

// workflow_status の成功レスポンス例
{
  "success": true,
  "data": {
    "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
    "taskName": "task-index-jsonキャッシュ同期の根本原因修正",
    "phase": "ui_design",
    "cacheConsistency": "OK"
  },
  "metadata": {
    "timestamp": "2026-02-15T10:30:45.123Z",
    "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
    "phase": "ui_design"
  }
}
```

### エラーレスポンスの標準形式

全てのエラーレスポンスは以下の構造を持ちます。

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string; // エラーコード（例: "CACHE_MISMATCH", "INVALID_PHASE"）
    message: string; // 人間が読めるエラーメッセージ
    details?: Record<string, unknown>; // 追加の診断情報
  };
  metadata: {
    timestamp: string;
    taskId?: string;
  };
}

// キャッシュ不整合エラーの例
{
  "success": false,
  "error": {
    "code": "CACHE_MISMATCH",
    "message": "task-index.json and workflow-state.json report different phases",
    "details": {
      "taskIndexPhase": "implementation",
      "workflowStatePhase": "commit",
      "recommendation": "Restart MCP server or set TASK_INDEX_TTL_MS=0"
    }
  },
  "metadata": {
    "timestamp": "2026-02-15T10:35:00.789Z",
    "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正"
  }
}
```

### エラーコード体系

本タスクで追加される新しいエラーコードを定義します。

| エラーコード | 説明 | HTTPステータス相当 |
|-------------|------|------------------|
| `CACHE_MISMATCH` | task-index.jsonとworkflow-state.jsonのフェーズが不整合 | 409 Conflict |
| `TASK_INDEX_READ_ERROR` | task-index.jsonの読み取り失敗 | 500 Internal Error |
| `TASK_INDEX_WRITE_ERROR` | task-index.jsonの書き込み失敗 | 500 Internal Error |
| `INVALID_TASK_ID` | 指定されたtaskIdが存在しない | 404 Not Found |
| `PHASE_TRANSITION_ERROR` | フェーズ遷移中にエラーが発生 | 500 Internal Error |

これらのエラーコードにより、フロントエンド側で適切なエラーハンドリングが可能になります。

### キャッシュ整合性レスポンス拡張

workflow_statusとworkflow_nextのレスポンスにcacheConsistencyフィールドを追加します。

```typescript
interface CacheConsistency {
  status: "OK" | "MISMATCH" | "UNKNOWN";
  taskIndexPhase?: string;
  workflowStatePhase?: string;
  warning?: string;
  recommendation?: string;
}

// レスポンスに含まれるcacheConsistency例
{
  "cacheConsistency": {
    "status": "MISMATCH",
    "taskIndexPhase": "implementation",
    "workflowStatePhase": "commit",
    "warning": "task-index.json contains stale phase information",
    "recommendation": "Restart MCP server or set TASK_INDEX_TTL_MS=0"
  }
}
```

このフィールドにより、開発者は即座にキャッシュ問題を認識できます。

## 設定ファイル設計

task-index.jsonはワークフロープラグインの中核データ構造であり、全アクティブタスクのメタデータを格納します。
本セクションではtask-index.jsonのスキーマ定義、フィールドの意味、更新ルールを明確化します。
新規追加のupdateTaskIndexForSingleTask()メソッドはこのスキーマに基づいて安全に該当タスクのみを更新します。

### task-index.json スキーマ定義

task-index.jsonは以下のTypeScript型で定義されるJSON配列です。

```typescript
interface TaskIndexEntry {
  taskId: string;           // タスクID（例: "20260215_123456_タスク名"）
  taskName: string;         // タスク名
  phase: string;            // 現在のフェーズ（例: "ui_design", "commit"）
  createdAt: string;        // ISO 8601形式のタイムスタンプ
  updatedAt: string;        // ISO 8601形式のタイムスタンプ
  workflowDir: string;      // workflow-state.jsonのディレクトリパス
  docsDir?: string;         // ドキュメント出力ディレクトリ（オプション）
  status: "active" | "completed" | "failed"; // タスクステータス
}

type TaskIndex = TaskIndexEntry[];
```

実際のファイル例は以下の通りです。

```json
[
  {
    "taskId": "20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
    "taskName": "task-index-jsonキャッシュ同期の根本原因修正",
    "phase": "ui_design",
    "createdAt": "2026-02-15T09:00:00.000Z",
    "updatedAt": "2026-02-15T10:30:45.123Z",
    "workflowDir": ".claude/state/workflows/20260215_123456_task-index-jsonキャッシュ同期の根本原因修正",
    "docsDir": "docs/workflows/task-index-jsonキャッシュ同期の根本原因修正",
    "status": "active"
  },
  {
    "taskId": "20260214_205843_artifact-validatorテーブル行除外",
    "taskName": "artifact-validatorテーブル行除外",
    "phase": "completed",
    "createdAt": "2026-02-14T20:58:43.000Z",
    "updatedAt": "2026-02-14T21:30:00.000Z",
    "workflowDir": ".claude/state/workflows/20260214_205843_artifact-validatorテーブル行除外",
    "docsDir": "docs/workflows/artifact-validatorテーブル行除外",
    "status": "completed"
  }
]
```

### フィールド説明

各フィールドの詳細な説明を以下に示します。

**taskId**: ワークフロー開始時にタイムスタンプとタスク名から自動生成される一意の識別子です。
ファイルパスやディレクトリ名に使用されるため、ファイルシステムで有効な文字のみを含みます。

**taskName**: ユーザーが指定したタスクの人間が読める名前です。
日本語文字列も許容され、ドキュメント出力ディレクトリ名として使用されます。

**phase**: 現在のワークフローフェーズを示す文字列です。
有効な値は定義されたフェーズ名（research, requirements, ui_design, commit等）のいずれかです。
このフィールドがworkflow-state.jsonのphaseと一致していることが重要です。

**createdAt**: タスクが作成された日時をISO 8601形式で記録します。
このフィールドは作成後変更されません。

**updatedAt**: タスクが最後に更新された日時をISO 8601形式で記録します。
フェーズ遷移時に必ず更新されます。

**workflowDir**: workflow-state.jsonが配置されているディレクトリの絶対パスまたは相対パスです。
MCP serverはこのパスを使用してworkflow-state.jsonを読み込みます。

**docsDir**: ドキュメント成果物（spec.md, ui-design.md等）が配置されるディレクトリのパスです。
環境変数DOCS_DIRでオーバーライド可能で、未設定の場合はデフォルト値が使用されます。

**status**: タスクの現在の状態を示します。
"active"は進行中のタスク、"completed"は完了したタスク、"failed"は失敗したタスクを意味します。

### 更新ルール

task-index.jsonの更新は以下のルールに従います。

**原則1: フェーズ遷移時の即座更新**
workflow_nextやworkflow_approveによりフェーズが遷移した際、updateTaskPhase()は即座にtask-index.jsonを更新します。
本修正によりupdateTaskIndexForSingleTask()メソッドが使用され、該当タスクのphaseとupdatedAtのみが更新されます。

**原則2: キャッシュ経由の読み取り禁止**
updateTaskIndexForSingleTask()はdiscoverTasks()のキャッシュを経由せず、fs.readFileSync()で直接task-index.jsonを読み込みます。
これによりキャッシュ競合が発生しません。

**原則3: アトミックな書き込み**
task-index.jsonへの書き込みはatomicWriteJson()を使用し、書き込み中にプロセスがクラッシュしてもファイルが破損しないことを保証します。

**原則4: updatedAtの更新**
フェーズ遷移時はphaseフィールドとupdatedAtフィールドの両方を更新します。
他のフィールド（taskId, taskName, createdAt, workflowDir, docsDir）は変更しません。

### updateTaskIndexForSingleTask()の動作

新規追加のupdateTaskIndexForSingleTask()メソッドは以下の手順でtask-index.jsonを更新します。

1. task-index.jsonをfs.readFileSync()で直接読み込み、配列をパース
2. taskIdでエントリを検索し、該当エントリを特定
3. エントリのphaseフィールドを新しいフェーズに更新
4. エントリのupdatedAtフィールドを現在時刻に更新
5. 配列全体をatomicWriteJson()でtask-index.jsonに書き込み

この手順によりdiscoverTasks()のキャッシュを経由せず、確実に最新のフェーズ情報がtask-index.jsonに反映されます。

### キャッシュTTL設定

discover-tasks.jsのキャッシュTTLは以下の環境変数で制御されます。

```bash
# デフォルト値（discover-tasks.js L21）
TASK_INDEX_TTL_MS=3600000  # 1時間

# キャッシュ無効化
TASK_INDEX_TTL_MS=0

# 短いTTL（開発時）
TASK_INDEX_TTL_MS=5000  # 5秒
```

本修正後はデフォルトTTLのままでも問題は発生しませんが、診断のため環境変数でオーバーライド可能です。

## 関連ファイル

本UIインターフェース設計に関連するソースコードファイルは以下の通りです。

- **workflow-plugin/mcp-server/src/state/manager.ts**: updateTaskIndexForSingleTask()メソッドの実装とAPIレスポンス生成
- **workflow-plugin/hooks/phase-edit-guard.js**: エラーメッセージの生成とB-2チェックロジック
- **workflow-plugin/hooks/lib/discover-tasks.js**: task-index.jsonのキャッシュ管理とTTL設定
- **workflow-plugin/mcp-server/src/tools/status.ts**: workflow_statusツールのレスポンス生成
- **workflow-plugin/mcp-server/src/tools/next.ts**: workflow_nextツールのレスポンス生成

これらのファイルを変更する際は、本UIインターフェース設計ドキュメントに定義されたレスポンス形式とエラーメッセージ規約に従ってください。
