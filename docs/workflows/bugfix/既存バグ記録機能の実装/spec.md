# 既存バグ記録機能 - 技術仕様書

## 1. アーキテクチャ

### コンポーネント構成

```
mcp-server/src/
├── state/
│   └── types.ts          # KnownBug型追加
├── tools/
│   └── test-tracking.ts  # 新ツール追加
└── server.ts             # ツール登録
```

## 2. 型定義

### KnownBug

```typescript
/**
 * 既知バグの記録
 */
export interface KnownBug {
  /** バグID（自動生成: BUG-001形式） */
  bugId: string;
  /** 失敗するテスト名 */
  testName: string;
  /** バグの説明 */
  description: string;
  /** 深刻度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 関連Issue URL（オプション） */
  issueUrl?: string;
  /** 対応予定 */
  targetPhase: 'next_sprint' | 'backlog' | 'deferred';
  /** 記録日時（ISO 8601形式） */
  recordedAt: string;
}
```

### TaskState拡張

```typescript
interface TaskState {
  // ...既存フィールド
  /** 既知バグ一覧 */
  knownBugs?: KnownBug[];
}
```

## 3. MCPツール仕様

### workflow_record_known_bug

| 項目 | 内容 |
|------|------|
| 名前 | `workflow_record_known_bug` |
| 説明 | 既知バグを記録する |
| 使用フェーズ | regression_test |

**入力スキーマ**:
```json
{
  "type": "object",
  "properties": {
    "taskId": { "type": "string", "description": "タスクID（必須）" },
    "testName": { "type": "string", "description": "失敗するテスト名" },
    "description": { "type": "string", "description": "バグの説明" },
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "深刻度"
    },
    "issueUrl": { "type": "string", "description": "関連Issue URL" },
    "targetPhase": {
      "type": "string",
      "enum": ["next_sprint", "backlog", "deferred"],
      "description": "対応予定"
    }
  },
  "required": ["taskId", "testName", "description", "severity"]
}
```

**戻り値**:
```typescript
interface RecordKnownBugResult extends ToolResult {
  bugId?: string;
  knownBugs?: KnownBug[];
}
```

### workflow_get_known_bugs

| 項目 | 内容 |
|------|------|
| 名前 | `workflow_get_known_bugs` |
| 説明 | 既知バグ一覧を取得する |
| 使用フェーズ | 任意 |

**入力スキーマ**:
```json
{
  "type": "object",
  "properties": {
    "taskId": { "type": "string", "description": "タスクID（必須）" }
  },
  "required": ["taskId"]
}
```

**戻り値**:
```typescript
interface GetKnownBugsResult extends ToolResult {
  knownBugs?: KnownBug[];
  count?: number;
}
```

## 4. 実装詳細

### バグID生成

```typescript
function generateBugId(existingBugs: KnownBug[]): string {
  const maxId = existingBugs.reduce((max, bug) => {
    const num = parseInt(bug.bugId.replace('BUG-', ''), 10);
    return Math.max(max, num);
  }, 0);
  return `BUG-${String(maxId + 1).padStart(3, '0')}`;
}
```

### フェーズチェック

```typescript
if (taskState.phase !== 'regression_test') {
  return {
    success: false,
    message: `既知バグの記録はregression_testフェーズでのみ可能です。現在: ${taskState.phase}`,
  };
}
```

## 5. エラーハンドリング

| エラー条件 | メッセージ |
|-----------|-----------|
| タスクが存在しない | `タスクが見つかりません: {taskId}` |
| フェーズ違反 | `既知バグの記録はregression_testフェーズでのみ可能です` |
| 必須パラメータ欠落 | `{param}は必須です` |
| 重複テスト名 | `このテストは既に記録されています: {testName}` |

## 6. 関連ファイル

- `mcp-server/src/state/types.ts`
- `mcp-server/src/tools/test-tracking.ts`
- `mcp-server/src/tools/index.ts`
- `mcp-server/src/server.ts`
