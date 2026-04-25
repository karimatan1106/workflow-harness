# 既存バグ記録機能 - 要件定義

## 1. 背景と目的

### 問題
- テスト失敗時に「既存バグだから」という理由でテストを削除する行為が発生
- バグが記録されずに放置される
- リグレッションの検出が困難になる

### 目的
- 既存バグを適切に記録・追跡する仕組みを提供
- テスト削除ではなく、バグ記録を促す
- 別タスクでの修正を計画できるようにする

## 2. 機能要件

### FR-1: 既知バグ記録ツール

| 項目 | 内容 |
|------|------|
| ツール名 | `workflow_record_known_bug` |
| 使用フェーズ | regression_test のみ |
| 必須パラメータ | taskId, testName, description, severity |
| オプション | issueUrl, targetPhase |

### FR-2: 既知バグ一覧取得ツール

| 項目 | 内容 |
|------|------|
| ツール名 | `workflow_get_known_bugs` |
| 使用フェーズ | 任意 |
| パラメータ | taskId |
| 戻り値 | knownBugs配列 |

### FR-3: TaskState拡張

```typescript
interface KnownBug {
  bugId: string;              // 自動生成（BUG-001形式）
  testName: string;           // 失敗テスト名
  description: string;        // バグ説明
  severity: 'low' | 'medium' | 'high' | 'critical';
  issueUrl?: string;          // Issue URL
  targetPhase: 'next_sprint' | 'backlog' | 'deferred';
  recordedAt: string;         // 記録日時
}

interface TaskState {
  // ...既存
  knownBugs?: KnownBug[];
}
```

### FR-4: フェーズ制限

- `workflow_record_known_bug` は regression_test フェーズでのみ使用可能
- 他フェーズで呼び出した場合はエラー

## 3. 非機能要件

### NFR-1: 既存機能との互換性
- 既存のテスト追跡機能（testFiles, testBaseline）に影響を与えない

### NFR-2: パフォーマンス
- バグ記録の処理時間は100ms以内

### NFR-3: 保守性
- 既存の test-tracking.ts と同じファイルに実装
- 一貫したコーディングスタイル

## 4. 受け入れ基準

### AC-1: バグ記録
- [ ] regression_testフェーズで `workflow_record_known_bug` を呼び出せる
- [ ] bugIdが自動生成される（BUG-001, BUG-002...）
- [ ] TaskStateに保存される

### AC-2: バグ一覧取得
- [ ] `workflow_get_known_bugs` で記録済みバグを取得できる
- [ ] 空の場合は空配列を返す

### AC-3: フェーズ制限
- [ ] regression_test以外のフェーズではエラーになる
- [ ] エラーメッセージが適切

### AC-4: ビルド
- [ ] TypeScriptビルドが成功する
- [ ] 既存テストに影響がない

## 5. スコープ外

- GitHub Issue自動作成
- テストファイル削除防止フック（別タスク）
- バグ修正完了時の自動処理

## 6. 関連ドキュメント

- [調査結果](./research.md)
- [テスト追跡機能仕様](../../spec/features/test-tracking.md)
