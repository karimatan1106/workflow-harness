# UI設計: ワークフロー1000万行対応強化

**文書作成日**: 2026-02-07
**フェーズ**: ui_design（parallel_design）
**バージョン**: 1.0

---

## 目次

1. [概要](#概要)
2. [CLI出力フォーマット](#cli出力フォーマット)
3. [MCPツール戻り値スキーマ](#mcpツール戻り値スキーマ)
4. [監査ログのJSONLスキーマ](#監査ログのjsonlスキーマ)
5. [エラーメッセージ設計](#エラーメッセージ設計)
6. [ユーザーインタラクションフロー](#ユーザーインタラクションフロー)

---

## 概要

本ドキュメントは、ワークフロー管理プラグイン（MCP Server + フック）の4つの致命的なセキュリティ/品質検証問題を解決するためのUI（CLI出力）設計を定義します。

このプロジェクトはCLIツールであり、グラフィカルUIはありません。UIはすべてコンソール出力として実装されます。

---

## CLI出力フォーマット

### 2.1 テスト結果偽造検出時のエラーメッセージ

#### 2.1.1 AC-1.1: exitCode=0だが失敗キーワード含む

```
[record-test-result] エラー: テスト出力が矛盾しています

テスト出力に失敗を示すキーワードが含まれていますが、exitCodeは0（成功）です。
テスト実行結果を確認してください。

詳細:
  - exitCode: 0
  - 検出されたキーワード: FAILED, ERROR
  - 出力の一部: "5 tests passed, 2 FAILED"

対応:
  テスト実行結果が正しいことを確認した上で、
  再度 workflowRecordTestResult を呼び出してください。
```

#### 2.1.2 AC-1.2: exitCode≠0だが成功キーワードのみ

```
[record-test-result] エラー: テスト出力が矛盾しています

テスト出力は全テスト成功を示していますが、exitCodeは非ゼロ（失敗）です。
テスト実行結果を確認してください。

詳細:
  - exitCode: 1
  - 検出されたキーワード: "All tests passed"
  - 失敗キーワード: なし

対応:
  テスト実行結果が正しいことを確認した上で、
  再度 workflowRecordTestResult を呼び出してください。
```

#### 2.1.3 AC-1.3: テストフレームワーク構造なし（警告）

```
[record-test-result] 警告: テストフレームワークの構造が検出されませんでした

テスト実行の出力であることを確認してください。

検出されるべきパターン:
  - "N tests passed" または "N test passed"
  - "PASS  ./file.test.ts"
  - "✓ should validate input"
  - "Test Suites: 1 passed, 1 total" (Jest)

テスト結果は記録されます（検証継続）。
```

#### 2.1.4 AC-1.4: エラーパターン検出時の警告

```
[record-test-result] 警告: テスト出力にエラーパターンが含まれています

テスト出力にスタックトレース、Assertion error、Uncaught exception などが含まれています。
テスト結果を確認してください。

検出されたエラーパターン:
  - スタックトレース: "at user.ts:10:5"
  - Assertion error: "Expected 5 but got 10"

テスト結果は記録されます（検証継続）。
```

---

### 2.2 設計検証エラーのレポートフォーマット

#### 2.2.1 ファイル構造検証エラー

```
[design-validator] 設計-実装整合性検証結果

❌ 検証失敗

=== 未実装項目 ===
1. ファイル: src/validation/ast-analyzer.ts
   理由: ファイルが存在しません
   期待パス: /mnt/c/.../src/validation/ast-analyzer.ts

2. クラス: DesignValidator
   理由: クラスが見つかりません
   期待ファイル: src/validation/design-validator.ts

3. メソッド: validateAll
   理由: メソッドが見つかりません
   期待クラス: DesignValidator

=== 警告 ===
・空のクラスが検出されました: EmptyHandler in handlers.ts
・空のメソッドが検出されました: process in EmptyHandler
・単なるreturnのみのメソッドが検出されました: getValue in Service

サマリー:
  合計項目: 15
  実装済み: 12
  未実装: 3

対応:
  implementationフェーズで上記の項目を実装してください。
  詳細: docs/workflows/{taskName}/spec.md を確認
```

#### 2.2.2 ステートマシン図の検証エラー

```
[design-validator] state-machine.mmd 構造検証

❌ 警告あり

ノード数: 5
エッジ数: 3

警告:
  - ノードはありますが、遷移が不足しています
    ノード: 5, 最小遷移数: 4, 実際: 3
  - 孤立したノードが検出されました: Obsolete, Debug

対応:
  state-machine.mmd で以下を確認:
  1. 全ノードが少なくとも1つの遷移を持つか
  2. 孤立ノード（Obsolete, Debug）が必要か確認
```

#### 2.2.3 フローチャートの検証エラー

```
[design-validator] flowchart.mmd 構造検証

❌ エラーあり

ノード数: 4
エッジ数: 0

エラー:
  - フローチャートに接続がありません
    ノードが定義されていますが、エッジ（フロー）がありません

対応:
  flowchart.mmd で各ノード間の接続を定義してください。
```

---

### 2.3 スコープ検証の警告メッセージ

#### 2.3.1 スコープ外依存の警告

```
[set-scope] 警告: スコープ外依存が検出されました

スコープに含まれるファイル: 10 個
スコープ外依存: 5 個

依存ファイル（最大10件表示）:
  - src/lib/utils.ts
  - src/hooks/use-auth.ts
  - src/components/Button.tsx
  - src/context/AuthContext.ts
  - src/types/auth.types.ts

... 他 0 件

推奨スコープ（依存ファイルを含む）:
files: [
  "src/features/checkout/index.ts",
  "src/features/checkout/types.ts",
  "src/features/checkout/hooks.ts",
  "src/lib/utils.ts",
  "src/hooks/use-auth.ts",
  "src/components/Button.tsx",
  "src/context/AuthContext.ts",
  "src/types/auth.types.ts"
]

対応:
  影響範囲を更新する場合、上記の推奨スコープを参考にしてください。
```

#### 2.3.2 存在しないファイル/ディレクトリエラー

```
[set-scope] エラー: 存在しないファイル/ディレクトリ

存在しないファイル:
  - src/features/checkout/utils-old.ts
  - src/lib/deprecated.ts

存在しないディレクトリ:
  - src/old-features/

対応:
  存在するファイル/ディレクトリのみを指定してください。
```

#### 2.3.3 スコープ内の依存関係サマリー

```
[set-scope] 影響範囲を設定しました

設定内容:
  ファイル: 8 個
  ディレクトリ: 2 個

依存関係解析結果:
  スコープ内ファイル: 85 個
  検出されたimport: 23 個
  スコープ外依存: 5 個

詳細:
  - src/lib/utils.ts (スコープ外)
  - src/hooks/use-auth.ts (スコープ外)
  - src/components/Button.tsx (スコープ外)
  ... 他 2 個

推奨: 上記のスコープ外依存をスコープに含めることを検討してください。
```

---

### 2.4 監査ログイベント出力フォーマット

#### 2.4.1 バイパス環境変数有効化時

```
[audit-logger] バイパス環境変数が有効です

環境変数: SKIP_PHASE_GUARD
イベント: bypass_enabled
タイムスタンプ: 2026-02-07T10:30:45.123Z

ログファイル: .claude/state/audit-log.jsonl
詳細: リーダーが `SKIP_PHASE_GUARD=true` を設定しました
```

#### 2.4.2 バイパス使用回数が閾値超過

```
[audit-logger] ⚠️  警告: バイパス使用回数が閾値を超えました

過去1時間のバイパス使用回数: 12 回
閾値: 10 回

検出されたバイパス:
  1. 10:15:30 - SKIP_PHASE_GUARD (task: task-123, phase: implementation)
  2. 10:16:45 - SKIP_DESIGN_VALIDATION (task: task-123, phase: implementation)
  3. 10:18:00 - SKIP_PHASE_GUARD (task: task-456, phase: testing)
  ... 他 9 件

対応:
  1. 詳細ログを確認: .claude/state/audit-log.jsonl
  2. バイパスが本当に必要か検討してください
  3. 設計-実装整合性の検証をお勧めします

詳細ログコマンド:
  cat .claude/state/audit-log.jsonl | jq .
```

---

## MCPツール戻り値スキーマ

### 3.1 workflowRecordTestResult の戻り値

#### 3.1.1 成功時

```typescript
{
  success: true,
  taskId: "task-123",
  phase: "testing",
  result: {
    phase: "testing",
    exitCode: 0,
    timestamp: "2026-02-07T10:30:45.123Z",
    summary: "All tests passed",
    output: "✓ should validate input\n✓ should handle errors\n\n5 tests passed",
    passedCount: 5,
    failedCount: 0
  },
  message: "テスト結果を記録しました（exitCode: 0）"
}
```

#### 3.1.2 整合性検証エラー（AC-1.1）

```typescript
{
  success: false,
  message: "テスト出力に失敗を示すキーワードが含まれていますが、exitCodeは0（成功）です。テスト実行結果を確認してください。",
  errorCode: "TEST_OUTPUT_CONSISTENCY_ERROR",
  details: {
    exitCode: 0,
    hasFailureKeyword: true,
    detectedKeywords: ["FAILED", "ERROR"],
    outputPreview: "5 tests passed, 2 FAILED..."
  }
}
```

#### 3.1.3 整合性検証エラー（AC-1.2）

```typescript
{
  success: false,
  message: "テスト出力は全テスト成功を示していますが、exitCodeは非ゼロ（失敗）です。テスト実行結果を確認してください。",
  errorCode: "TEST_OUTPUT_CONSISTENCY_ERROR",
  details: {
    exitCode: 1,
    hasSuccessKeyword: true,
    hasFailureKeyword: false,
    detectedKeywords: ["All tests passed"],
    outputPreview: "All tests passed successfully..."
  }
}
```

#### 3.1.4 警告付き成功（AC-1.3）

```typescript
{
  success: true,
  taskId: "task-123",
  phase: "testing",
  result: {
    phase: "testing",
    exitCode: 0,
    timestamp: "2026-02-07T10:30:45.123Z",
    summary: undefined,
    output: "Everything is fine. No problems detected. Processing complete. All systems operational.",
    passedCount: undefined,
    failedCount: undefined
  },
  message: "テスト結果を記録しました（exitCode: 0）",
  warnings: ["テストフレームワークの構造が検出されませんでした。テスト実行の出力であることを確認してください。"]
}
```

---

### 3.2 workflowSetScope の戻り値

#### 3.2.1 成功時（スコープ外依存なし）

```typescript
{
  success: true,
  taskId: "task-123",
  scope: {
    affectedFiles: ["src/features/checkout/index.ts", "src/features/checkout/types.ts"],
    affectedDirs: ["src/components/checkout/"]
  },
  message: "影響範囲を設定しました（ファイル: 2件, ディレクトリ: 1件）"
}
```

#### 3.2.2 成功時（スコープ外依存あり・警告付き）

```typescript
{
  success: true,
  taskId: "task-123",
  scope: {
    affectedFiles: ["src/features/checkout/index.ts"],
    affectedDirs: ["src/components/checkout/"]
  },
  message: "影響範囲を設定しました（ファイル: 1件, ディレクトリ: 1件）",
  warnings: ["スコープ外依存が5件検出されました（詳細はコンソールを確認）"]
}
```

#### 3.2.3 ファイル未存在エラー

```typescript
{
  success: false,
  message: "存在しないファイル: src/old-feature.ts\n存在しないディレクトリ: src/deleted-components/",
  errorCode: "FILE_NOT_FOUND",
  details: {
    nonExistentFiles: ["src/old-feature.ts"],
    nonExistentDirs: ["src/deleted-components/"]
  }
}
```

#### 3.2.4 空スコープエラー

```typescript
{
  success: false,
  message: "files または dirs の少なくとも1つを指定してください",
  errorCode: "EMPTY_SCOPE"
}
```

---

### 3.3 performDesignValidation の戻り値（design-validator.ts）

#### 3.3.1 検証成功

```typescript
{
  passed: true,
  phase: "validation",
  timestamp: "2026-02-07T10:30:45.123Z",
  summary: {
    total: 20,
    implemented: 20,
    missing: 0
  },
  missingItems: [],
  warnings: []
}
```

#### 3.3.2 検証失敗（未実装項目あり）

```typescript
{
  passed: false,
  phase: "validation",
  timestamp: "2026-02-07T10:30:45.123Z",
  summary: {
    total: 20,
    implemented: 17,
    missing: 3
  },
  missingItems: [
    {
      type: "file",
      source: "spec.md",
      name: "src/validation/ast-analyzer.ts",
      expectedPath: "/mnt/c/.../src/validation/ast-analyzer.ts"
    },
    {
      type: "class",
      source: "spec.md",
      name: "ASTAnalyzer",
      expectedPath: "src/validation/ast-analyzer.ts"
    },
    {
      type: "method",
      source: "spec.md",
      name: "analyzeClasses",
      expectedPath: "ASTAnalyzer"
    }
  ],
  warnings: [
    "空のクラスが検出されました: EmptyHandler in handlers.ts",
    "state-machine.mmd: ノードはありますが、遷移が定義されていません",
    "flowchart.mmd: 孤立したノードが検出されました: Debug, Obsolete"
  ]
}
```

---

## 監査ログのJSONLスキーマ

### 4.1 ログエントリの構造

```jsonl
{"timestamp":"2026-02-07T10:30:45.123Z","event":"bypass_enabled","variable":"SKIP_PHASE_GUARD","taskId":null,"phase":null}
{"timestamp":"2026-02-07T10:31:12.456Z","event":"bypass_enabled","variable":"SKIP_DESIGN_VALIDATION","taskId":"task-123","phase":"implementation"}
{"timestamp":"2026-02-07T10:32:00.789Z","event":"bypass_threshold_exceeded","count":12,"window":"1h"}
```

### 4.2 フィールド仕様

| フィールド | 型 | 必須 | 説明 | 例 |
|-----------|-----|------|------|-----|
| `timestamp` | ISO8601 string | ✅ | イベント発生時刻 | `"2026-02-07T10:30:45.123Z"` |
| `event` | enum | ✅ | イベント種別 | `"bypass_enabled"` \| `"bypass_threshold_exceeded"` |
| `variable` | string | - | 環境変数名 | `"SKIP_PHASE_GUARD"`, `"SKIP_DESIGN_VALIDATION"`, `"SKIP_SPEC_GUARD"`, `"SKIP_LOOP_DETECTION"`, `"SKIP_ARTIFACT_CHECK"`, `"SKIP_DESIGN_VALIDATION"`, `"FAIL_OPEN"` |
| `taskId` | string \| null | - | タスクID | `"task-123"`, `null` |
| `phase` | string \| null | - | ワークフローフェーズ | `"research"`, `"implementation"`, `"testing"`, `null` |
| `count` | number | - | カウント値 | `12` |
| `window` | string | - | 時間窓 | `"1h"`, `"24h"` |

### 4.3 イベント種別の詳細

#### 4.3.1 bypass_enabled

環境変数バイパスが有効化されたときに記録される。

```json
{
  "timestamp": "2026-02-07T10:30:45.123Z",
  "event": "bypass_enabled",
  "variable": "SKIP_PHASE_GUARD",
  "taskId": "task-123",
  "phase": "implementation"
}
```

**記録タイミング:**
- フック実行開始時に環境変数をチェック
- バイパス変数（`SKIP_*`）が`true`の場合に記録

**フィールド:**
- `variable`: バイパスに使用された環境変数名
- `taskId`: タスクID（取得可能な場合）
- `phase`: 現在のワークフローフェーズ（取得可能な場合）

#### 4.3.2 bypass_threshold_exceeded

バイパス使用回数が閾値を超えたときに記録される。

```json
{
  "timestamp": "2026-02-07T10:32:00.789Z",
  "event": "bypass_threshold_exceeded",
  "count": 12,
  "window": "1h"
}
```

**記録タイミング:**
- `AuditLogger.checkThreshold()` 呼び出し時
- 過去1時間のバイパス使用回数が10を超えた場合

**フィールド:**
- `count`: 過去1時間のバイパス使用回数
- `window`: 時間窓（`"1h"` 固定）

---

### 4.4 ログファイルの配置と管理

#### 4.4.1 ログファイルパス

```
.claude/state/audit-log.jsonl
.claude/state/audit-log.jsonl.1
.claude/state/audit-log.jsonl.2
...
.claude/state/audit-log.jsonl.5
```

#### 4.4.2 ローテーション仕様

- **閾値**: 10MB
- **世代数**: 最大5世代（.1 ~ .5）
- **削除**: .5 以上は削除

**ローテーション手順:**
1. ログファイルサイズを確認
2. サイズが10MBを超えた場合、ローテーション実行
3. `.4 → .5`, `.3 → .4`, ..., `本ファイル → .1`
4. 新しいログファイルを作成開始

#### 4.4.3 ログ例（時系列）

```jsonl
# audit-log.jsonl - 現在のログファイル
{"timestamp":"2026-02-07T10:30:45.123Z","event":"bypass_enabled","variable":"SKIP_PHASE_GUARD","taskId":"task-123","phase":"implementation"}
{"timestamp":"2026-02-07T10:31:12.456Z","event":"bypass_enabled","variable":"SKIP_DESIGN_VALIDATION","taskId":"task-123","phase":"implementation"}
{"timestamp":"2026-02-07T10:32:00.789Z","event":"bypass_threshold_exceeded","count":12,"window":"1h"}
{"timestamp":"2026-02-07T10:35:20.111Z","event":"bypass_enabled","variable":"FAIL_OPEN","taskId":null,"phase":null}
...

# audit-log.jsonl.1 - 1世代前のログファイル（10MB超時にローテーション）
{"timestamp":"2026-02-06T23:45:30.000Z","event":"bypass_enabled","variable":"SKIP_PHASE_GUARD",...}
...
```

---

## エラーメッセージ設計

### 5.1 エラーコード体系

| エラーコード | HTTP相当 | 説明 | 対応方法 |
|-------------|---------|------|---------|
| `TEST_OUTPUT_CONSISTENCY_ERROR` | 400 | テスト出力とexitCodeが矛盾 | テスト実行結果を確認して再実行 |
| `FILE_NOT_FOUND` | 400 | 指定ファイル/ディレクトリが存在しない | パスを確認して修正 |
| `EMPTY_SCOPE` | 400 | スコープが空（ファイルとディレクトリ両方なし） | 最低1つのファイルまたはディレクトリを指定 |
| `PHASE_MISMATCH` | 400 | フェーズが許可されていない操作 | 許可されたフェーズで実行 |
| `VALIDATION_FAILED` | 400 | 設計-実装整合性検証に失敗 | 未実装項目を実装 |
| `AST_PARSE_ERROR` | 400 | AST解析に失敗 | ファイルの構文を確認 |
| `AUDIT_LOG_ERROR` | 500 | 監査ログ書き込みに失敗 | ディスク容量とパーミッションを確認 |

### 5.2 メッセージレベル

```
[LEVEL] [COMPONENT] MESSAGE

レベル:
  エラー (ERROR)   - 処理をブロック、ユーザー対応必須
  警告 (WARN)     - 処理は続行、確認推奨
  情報 (INFO)     - 処理進行状況通知
  デバッグ (DEBUG) - 開発者向け詳細情報

コンポーネント:
  [record-test-result]
  [design-validator]
  [set-scope]
  [ast-analyzer]
  [dependency-analyzer]
  [audit-logger]
  [phase-edit-guard]
  [enforce-workflow]
  [block-dangerous-commands]
```

### 5.3 エラーメッセージのテンプレート

```
[COMPONENT] エラー: {簡潔な説明}

{詳細な説明}

詳細:
  - フィールド1: 値
  - フィールド2: 値
  ...

対応:
  1. {対応手順1}
  2. {対応手順2}
  ...

参考:
  ドキュメント: {ドキュメントパス}
  ログ: {ログファイルパス}
```

---

## ユーザーインタラクションフロー

### 6.1 スコープ設定フロー

```
ユーザー入力
  ↓
workflowSetScope(taskId, files, dirs)
  ↓
[バリデーション]
  ├─ ファイル/ディレクトリ存在チェック
  │   └─ エラー → 存在しないファイル/ディレクトリ列挙
  └─ スコープ空チェック
      └─ エラー → "files または dirs を指定してください"
  ↓
[依存関係解析]
  ├─ import文を抽出
  ├─ スコープ外依存を検出
  └─ 推奨スコープを生成
  ↓
[警告出力]
  └─ スコープ外依存がある場合、コンソール出力
  ↓
[スコープ記録]
  └─ TaskState.scope に保存
  ↓
成功レスポンス
  ├─ scope オブジェクト
  └─ warnings 配列（依存関係の場合）
```

### 6.2 テスト結果記録フロー

```
ユーザー入力
  ↓
workflowRecordTestResult(taskId, exitCode, summary, output)
  ↓
[バリデーション]
  ├─ フェーズチェック（testing/regression_test のみ）
  ├─ 引数チェック（exitCode は数値、output は必須）
  └─ output 最小長チェック（50文字以上）
  ↓
[整合性検証（Fail Closed）]
  ├─ AC-1.1: exitCode=0 + FAILキーワード
  │   └─ エラーをスロー
  ├─ AC-1.2: exitCode≠0 + PASSのみ
  │   └─ エラーをスロー
  ├─ AC-1.3: テストフレームワーク構造なし
  │   └─ 警告を出力（処理続行）
  └─ エラーパターン検出
      └─ 警告を出力（処理続行）
  ↓
[テスト件数自動抽出]
  ├─ passedCount を抽出
  └─ failedCount を抽出
  ↓
[テスト結果記録]
  └─ TaskState.testResults[] に追加
  ↓
成功レスポンス
  ├─ result オブジェクト
  └─ warnings 配列（該当する場合）
```

### 6.3 設計検証フロー

```
implementationフェーズ開始
  ↓
DesignValidator.validateAll()
  ↓
[ワークフロー設計書の読み込み]
  ├─ spec.md → クラス・メソッド・ファイル抽出
  ├─ state-machine.mmd → ノード・遷移解析
  └─ flowchart.mmd → ノード・エッジ解析
  ↓
[実装ファイルの解析]
  ├─ AST解析（空クラス・空メソッド検出）
  └─ 依存関係検証
  ↓
[検証結果の集約]
  ├─ missing 項目をリスト化
  ├─ warning を出力
  └─ passed フラグを設定
  ↓
ValidationResult オブジェクト
  ├─ passed: true/false
  ├─ summary: {total, implemented, missing}
  ├─ missingItems: 未実装項目の配列
  └─ warnings: 警告の配列
```

---

## 成果物サマリー

本UI設計ドキュメントでは、以下を定義しました:

1. **CLI出力フォーマット**
   - テスト結果偽造検出時のエラーメッセージ（4パターン）
   - 設計検証エラーのレポート（3パターン）
   - スコープ検証の警告（3パターン）
   - 監査ログイベント出力（2パターン）

2. **MCPツール戻り値スキーマ**
   - workflowRecordTestResult（成功、エラー、警告）
   - workflowSetScope（成功、警告、エラー）
   - performDesignValidation（成功、失敗）

3. **監査ログのJSONLスキーマ**
   - ログエントリ構造（6フィールド）
   - イベント種別の詳細（bypass_enabled, bypass_threshold_exceeded）
   - ローテーション仕様（10MB, 5世代）

4. **エラーメッセージ設計**
   - エラーコード体系（6種類）
   - メッセージレベル（ERROR, WARN, INFO, DEBUG）
   - メッセージテンプレート

5. **ユーザーインタラクションフロー**
   - スコープ設定フロー
   - テスト結果記録フロー
   - 設計検証フロー

---

**ドキュメント完成日**: 2026-02-07
**次のフェーズ**: design_review（設計レビュー）
