# ワークフロー並列タスク対応 - UI設計

## 概要

MCPサーバーはCLIツールであり、グラフィカルUIは存在しない。本ドキュメントではツールの出力形式（レスポンスJSON）を定義する。

## ツール出力形式

### workflow_status

#### taskId省略時（タスク一覧）

```json
{
  "success": true,
  "status": "active",
  "tasks": [
    {
      "taskId": "20260125_085458",
      "taskName": "タスクA",
      "phase": "research",
      "docsDir": "docs/workflows/タスクA/"
    },
    {
      "taskId": "20260125_090000",
      "taskName": "タスクB",
      "phase": "implementation",
      "docsDir": "docs/workflows/タスクB/"
    }
  ],
  "message": "2件のアクティブタスクがあります"
}
```

#### taskId指定時（タスク詳細）

```json
{
  "success": true,
  "status": "active",
  "taskId": "20260125_085458",
  "taskName": "タスクA",
  "phase": "research",
  "workflowDir": ".claude/state/workflows/20260125_085458_タスクA/",
  "docsDir": "docs/workflows/タスクA/",
  "subPhases": {
    "threat_modeling": false,
    "planning": false
  },
  "message": "調査フェーズ - 要件分析・既存コード調査"
}
```

### workflow_list

```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "20260125_085458",
      "taskName": "タスクA",
      "phase": "research",
      "workflowDir": ".claude/state/workflows/20260125_085458_タスクA/",
      "docsDir": "docs/workflows/タスクA/"
    }
  ],
  "message": "1件のアクティブタスクがあります"
}
```

### workflow_next

```json
{
  "success": true,
  "taskId": "20260125_085458",
  "from": "research",
  "to": "requirements",
  "description": "要件定義フェーズ - 機能要件・非機能要件を定義",
  "message": "research → requirements に遷移しました"
}
```

### workflow_approve

```json
{
  "success": true,
  "taskId": "20260125_085458",
  "type": "design",
  "phase": "design_review",
  "message": "設計レビューを承認しました"
}
```

### workflow_reset

```json
{
  "success": true,
  "taskId": "20260125_085458",
  "previousPhase": "implementation",
  "currentPhase": "research",
  "reason": "要件の見直しが必要",
  "message": "researchフェーズにリセットしました"
}
```

### workflow_complete_sub

```json
{
  "success": true,
  "taskId": "20260125_085458",
  "subPhase": "threat_modeling",
  "phase": "parallel_analysis",
  "remaining": ["planning"],
  "allCompleted": false,
  "message": "threat_modelingを完了しました。残り: planning"
}
```

## エラーレスポンス

### TASK_ID_REQUIRED

```json
{
  "success": false,
  "error": "TASK_ID_REQUIRED",
  "message": "taskIdは必須です"
}
```

### TASK_NOT_FOUND

```json
{
  "success": false,
  "error": "TASK_NOT_FOUND",
  "message": "指定されたタスクが見つかりません: 20260125_999999"
}
```

### NO_ACTIVE_TASKS

```json
{
  "success": false,
  "error": "NO_ACTIVE_TASKS",
  "message": "アクティブなタスクがありません"
}
```

## MCPツール定義の変更

### 削除されるツール

- `workflow_switch` - グローバルなアクティブタスク管理が不要になったため廃止

### パラメータ変更

| ツール | Before | After |
|--------|--------|-------|
| workflow_status | 引数なし | taskId?: string |
| workflow_next | 引数なし | taskId: string (必須) |
| workflow_approve | type: string | taskId: string, type: string |
| workflow_reset | reason?: string | taskId: string, reason?: string |
| workflow_complete_sub | subPhase: string | taskId: string, subPhase: string |
| workflow_list | 引数なし | 引数なし（変更なし） |
| workflow_start | taskName: string | taskName: string（変更なし） |

## Claude Codeでの表示

MCPツールの出力はClaude Codeによってフォーマットされて表示される。特別なフォーマット指定は不要。

### 推奨される使用パターン

```
# タスク一覧を確認
/workflow status

# 特定タスクの詳細を確認
/workflow status 20260125_085458

# タスクを次のフェーズに進める
/workflow next 20260125_085458
```

## Hookのメッセージ

### ファイルパス推論成功時

```
[phase-edit-guard] タスク "タスクA" (research) のファイルとして処理します
```

### ファイルパス推論失敗時（許可）

```
[phase-edit-guard] どのタスクにも属さないファイルです。編集を許可します
```

### 編集ブロック時

```
[phase-edit-guard] タスク "タスクA" (research) ではこのファイルの編集は許可されていません
```
