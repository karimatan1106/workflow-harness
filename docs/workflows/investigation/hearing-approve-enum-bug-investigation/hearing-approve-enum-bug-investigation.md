# harness_approve ツールスキーマ hearing enum 欠落バグ調査

## 概要

harness_approve のツール定義(inputSchema)の type enum に "hearing" が含まれていない。
内部ロジック(PHASE_APPROVAL_GATES, USER_APPROVAL_REQUIRED)には hearing が正しく登録されているため、スキーマのみが不整合。

## 調査結果

### 1. ツールスキーマ定義の場所

- ファイル: `workflow-harness/mcp-server/src/tools/defs-a.ts`
- 行番号: 54行目
- 現在の enum 値: `['requirements', 'design', 'test_design', 'code_review', 'acceptance']`
- "hearing" が欠落している

```typescript
// defs-a.ts L48-58
{
  name: 'harness_approve',
  description: 'Approve at gate phase.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID.' },
      type: { type: 'string', enum: ['requirements', 'design', 'test_design', 'code_review', 'acceptance'], description: 'Gate type.' },  // <-- L54: hearing 欠落
      sessionToken: { type: 'string', description: 'Session token.' },
    },
    required: ['taskId', 'type', 'sessionToken'],
  },
}
```

### 2. 内部ロジックでの hearing 登録状況(正常)

- ファイル: `workflow-harness/mcp-server/src/tools/handler-shared.ts`
- PHASE_APPROVAL_GATES (L19-26): hearing が登録済み (`hearing: 'hearing'`)
- USER_APPROVAL_REQUIRED (L29-36): hearing が登録済み (`hearing: true`)

```typescript
// handler-shared.ts L19-26
export const PHASE_APPROVAL_GATES: Record<string, string> = {
  requirements: 'requirements',
  design_review: 'design',
  test_design: 'test_design',
  code_review: 'code_review',
  acceptance_verification: 'acceptance',
  hearing: 'hearing',              // 登録済み
};

// handler-shared.ts L29-36
export const USER_APPROVAL_REQUIRED: Record<string, boolean> = {
  requirements: true,
  design: false,
  test_design: false,
  code_review: false,
  acceptance: true,
  hearing: true,                   // 登録済み
};
```

### 3. hearing フェーズの承認要求コード

- ファイル: `workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts`
- 行番号: 133-137
- harness_next 実行時、shouldRequireApproval が true を返すと PHASE_APPROVAL_GATES から approval type を取得し、未承認なら "requires approval" エラーを返す

### 4. approval.ts の hearing 未対応箇所

- ファイル: `workflow-harness/mcp-server/src/tools/handlers/approval.ts`
- L11-14: APPROVAL_ARTIFACT_MAP に hearing のエントリがない(hearing.md のハッシュ記録が行われない)
- これは ART-1 ドリフト検出に影響するが、approve 自体は動作する(artSuffix が undefined になり skip される)

## 修正箇所

### 必須修正(1箇所)

| ファイル | 行 | 修正内容 |
|---------|-----|---------|
| `workflow-harness/mcp-server/src/tools/defs-a.ts` | L54 | enum に `'hearing'` を追加 |

### 推奨修正(1箇所)

| ファイル | 行 | 修正内容 |
|---------|-----|---------|
| `workflow-harness/mcp-server/src/tools/handlers/approval.ts` | L11-14 | APPROVAL_ARTIFACT_MAP に `hearing: '/hearing.md'` を追加 |

## 影響

- スキーマバリデーションを行う MCP クライアントでは、type: "hearing" が拒否される
- LLM がツール呼び出し時に enum 外の値を選択できず、hearing フェーズで承認が不可能になる
- 内部ロジックは正常なので、スキーマ修正のみで解決する
