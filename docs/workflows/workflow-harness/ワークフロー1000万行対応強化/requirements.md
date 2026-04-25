# 要件定義書: ワークフロー1000万行対応強化

## 1. 概要

### 1.1 プロジェクト概要

本プロジェクトは、ワークフローMCPサーバープラグインにおける4つの致命的なセキュリティ/品質検証の問題を解決することを目的とする。

### 1.2 スコープ

**変更対象:**
- `workflow-plugin/mcp-server/src/` 配下のTypeScriptソースコード
- `workflow-plugin/hooks/` 配下のJavaScriptフックスクリプト

**対象外:**
- フロントエンド（存在しない）
- バックエンドAPI（存在しない）
- データベース（存在しない）
- 外部システム連携（存在しない）

このプロジェクトは**CLIツール（MCP Server + フック）のみ**を扱う。

### 1.3 問題の優先度

| 問題ID | 問題概要 | 優先度 |
|-------|---------|--------|
| P1 | テスト結果偽造が可能 | Critical |
| P2 | 設計検証がパターンマッチのみ | High |
| P3 | スコープの正当性検証がない | High |
| P4 | 環境変数バイパス監査なし | Critical |

---

## 2. 機能要件

### REQ-1: テスト結果偽造防止

#### REQ-1.1 テスト出力の整合性検証強化

**目的:**
`workflowRecordTestResult`でAIが任意の「成功」結果を記録できる問題を防止する。

**現状の問題:**
- `exitCode=0`と書くだけでテスト成功と記録される
- `output`文字列は50文字以上あれば任意の内容で通る
- テストフレームワークの実行を検証していない

**機能要件:**

1. **exitCodeとoutput内容の整合性チェック（FAIL_CLOSED）**
   - `exitCode=0`なのに以下のキーワードが含まれる場合はブロック:
     - "FAIL", "FAILED", "ERROR", "×", "✗", "failing"（大文字小文字不問）
   - `exitCode≠0`なのに以下の条件を満たす場合はブロック:
     - "PASS"または"passed"のみが含まれ、"FAIL"系キーワードがない

2. **テストフレームワーク構造の必須化**
   - output文字列に以下のいずれかのパターンが含まれることを要求:
     - `{数字} tests? passed`（例: "5 tests passed", "1 test passed"）
     - `Tests:.*{数字} passed`（Jestスタイル）
     - `PASS.*\.test\.(ts|js|tsx|jsx)`（ファイル名付き）
     - `✓.*test`（チェックマーク付きテストケース）
     - `Test Suites:.*{数字} passed`（Jest）
   - 上記パターンがない場合は警告を出し、ユーザーに確認を促す

3. **エラーパターンの検出**
   - output内に以下のエラーパターンがある場合は警告:
     - スタックトレース: `at.*\(.*\.ts:\d+:\d+\)`
     - Assertion error: `Expected.*but got`
     - Uncaught exception: `Uncaught|Unhandled`

**受け入れ基準:**

```typescript
// AC-1.1: exitCode=0 + FAILキーワード → ブロック
workflowRecordTestResult(taskId, {
  exitCode: 0,
  output: "5 tests passed, 2 FAILED"
}) // → Error: "Test output contains failure indicators but exitCode is 0"

// AC-1.2: exitCode≠0 + PASSのみ → ブロック
workflowRecordTestResult(taskId, {
  exitCode: 1,
  output: "All tests passed successfully"
}) // → Error: "Test output indicates success but exitCode is non-zero"

// AC-1.3: テストフレームワーク構造なし → 警告
workflowRecordTestResult(taskId, {
  exitCode: 0,
  output: "Everything is fine. No problems detected."
}) // → Warning: "Output does not contain recognizable test framework structure"

// AC-1.4: 正常なケース
workflowRecordTestResult(taskId, {
  exitCode: 0,
  output: "✓ should validate input (15ms)\n✓ should handle errors (8ms)\n\n5 tests passed"
}) // → Success
```

**変更対象ファイル:**
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/record-test-result.ts`

---

### REQ-2: 設計検証の強化

#### REQ-2.1 構造的検証の追加

**目的:**
正規表現ベースの表層的なチェックから、実際のコード構造を解析する検証に強化する。

**現状の問題:**
- `design-validator.ts`はクラス名・メソッド名の正規表現マッチのみ
- 空のクラス（`class Foo {}`）や空のメソッド（`method() {}`）でもパスする
- ステートマシン/フローチャートは要素数カウントのみ

**機能要件:**

1. **TypeScript AST解析の導入**
   - TypeScript Compiler APIを使用してソースコードを構文木に変換
   - クラス・メソッドの実装内容を構造的に検証

2. **クラス定義の検証**
   - クラスが最低1つのプロパティまたはメソッドを持つことを検証
   - 空のクラス（`{}`のみ）はNG
   - 最低限のコンストラクタまたはメソッド実装があることを確認

3. **メソッド定義の検証**
   - メソッドボディに最低1行以上の実行文があることを検証
   - 空のメソッド（`{}`のみ）、単なる`return`のみはNG
   - 少なくとも1つの変数宣言、代入、条件分岐、ループのいずれかが存在することを要求

4. **ステートマシン/フローチャートの検証強化**
   - ノード数だけでなく、エッジ（遷移/接続）の存在を検証
   - 孤立ノード（接続のないノード）の検出と警告
   - 最低限の遷移数（ノード数-1以上）を要求

**受け入れ基準:**

```typescript
// AC-2.1: 空のクラス → NG
class UserService {}
// → ValidationError: "Class UserService has no properties or methods"

// AC-2.2: 空のメソッド → NG
class UserService {
  getUser() {}
}
// → ValidationError: "Method getUser has no implementation statements"

// AC-2.3: 単なるreturnのみ → NG
class UserService {
  getUser() { return; }
}
// → ValidationError: "Method getUser has only a return statement"

// AC-2.4: 正常な実装 → OK
class UserService {
  getUser(id: string) {
    const user = this.repository.findById(id);
    if (!user) throw new Error("Not found");
    return user;
  }
}
// → Success

// AC-2.5: 孤立ノードのあるステートマシン → 警告
stateDiagram-v2
  [*] --> StateA
  StateB --> StateC
// → Warning: "StateB and StateC are isolated (no connection to initial state)"

// AC-2.6: 遷移のないフローチャート → NG
flowchart TD
  A[Start]
  B[Process]
  C[End]
// → ValidationError: "Flowchart has nodes but no edges"
```

**変更対象ファイル:**
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`
- 新規ファイル: `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/ast-analyzer.ts`（TypeScript AST解析用）

---

### REQ-3: スコープ検証の強化

#### REQ-3.1 スコープ設定時の存在チェック

**目的:**
AIが架空のファイル/ディレクトリをスコープに設定して迂回することを防止する。

**現状の問題:**
- `workflowSetScope(taskId, ["dummy.ts"], [])`で通過可能
- ファイルの存在確認がない
- 依存関係の検証がない

**機能要件:**

1. **ファイル/ディレクトリの存在チェック**
   - `files`配列の各ファイルが実際に存在することを検証
   - `directories`配列の各ディレクトリが実際に存在することを検証
   - 存在しない場合はエラーでブロック

2. **スコープの非空検証**
   - `files`と`directories`が両方とも空の場合はブロック
   - 最低1つのファイルまたはディレクトリが必要

3. **相対パスの正規化**
   - 相対パス（`./`, `../`）を絶対パスに正規化
   - プロジェクトルート外へのアクセス（`../../`等）を検出して警告

**受け入れ基準:**

```typescript
// AC-3.1: 存在しないファイル → NG
workflowSetScope(taskId, ["src/nonexistent.ts"], [])
// → Error: "File does not exist: src/nonexistent.ts"

// AC-3.2: 存在しないディレクトリ → NG
workflowSetScope(taskId, [], ["src/fake-dir"])
// → Error: "Directory does not exist: src/fake-dir"

// AC-3.3: 空のスコープ → NG
workflowSetScope(taskId, [], [])
// → Error: "Scope must include at least one file or directory"

// AC-3.4: 正常なスコープ → OK
workflowSetScope(taskId, ["src/user/service.ts"], ["src/user"])
// → Success
```

**変更対象ファイル:**
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`

---

#### REQ-3.2 依存関係解析によるスコープ妥当性警告

**目的:**
スコープに含まれるファイルが依存する他のファイルがスコープに含まれているかを検証する。

**現状の問題:**
- スコープが`["feature.ts"]`のみでも、実際には`["feature.ts", "utils.ts", "types.ts"]`が必要なケースがある
- 依存先がスコープ外だと、実装時に問題が発生する

**機能要件:**

1. **TypeScriptファイルのimport解析**
   - スコープに含まれる`.ts`/`.tsx`ファイルのimport文を解析
   - 相対import（`import { foo } from './utils'`）を抽出
   - 絶対import（`import { bar } from '@/utils'`）は対象外（外部パッケージ）

2. **依存先の存在チェック**
   - import先のファイルが実際に存在するか確認
   - 存在する場合、スコープに含まれているかチェック

3. **スコープ外依存の警告**
   - スコープに含まれるファイルが依存するが、スコープに含まれていないファイルを検出
   - 警告メッセージで推奨スコープを提示（ブロックはしない）

**受け入れ基準:**

```typescript
// ファイル: src/feature.ts
import { validate } from './utils';
import { User } from './types';

// AC-3.5: 依存先がスコープ外 → 警告
workflowSetScope(taskId, ["src/feature.ts"], [])
// → Warning: "feature.ts depends on src/utils.ts and src/types.ts, which are not in scope. Consider adding: ['src/utils.ts', 'src/types.ts']"

// AC-3.6: 依存先もスコープ内 → OK
workflowSetScope(taskId, ["src/feature.ts", "src/utils.ts", "src/types.ts"], [])
// → Success (no warnings)

// AC-3.7: ディレクトリスコープで依存先を含む → OK
workflowSetScope(taskId, [], ["src"])
// → Success (all dependencies within src/)
```

**変更対象ファイル:**
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
- 新規ファイル: `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/dependency-analyzer.ts`（import解析用）

---

### REQ-4: 環境変数バイパスの監査

#### REQ-4.1 バイパス使用の監査ログ記録

**目的:**
SKIP_*環境変数やFAIL_OPENの使用を記録し、不正な迂回を検出可能にする。

**現状の問題:**
- 7個のSKIP_*環境変数とFAIL_OPEN=trueが存在
- 使用時のログ記録がない
- 監査証跡がない

**機能要件:**

1. **監査ログファイルの作成**
   - ログファイル: `.claude/state/audit-log.jsonl`（JSON Lines形式）
   - 各行が1つのJSONオブジェクト（タイムスタンプ、イベント種別、詳細）

2. **バイパス検出時のログ記録**
   - 以下の環境変数が`true`の場合に記録:
     - `SKIP_PHASE_GUARD`
     - `SKIP_SPEC_GUARD`
     - `SKIP_LOOP_DETECTION`
     - `SKIP_DESIGN_VALIDATION`
     - `SKIP_ARTIFACT_CHECK`
     - `SKIP_TEST_FIRST_CHECK`
     - `SKIP_SPEC_SYNC_CHECK`
     - `FAIL_OPEN`
   - 記録内容:
     - `timestamp`: ISO8601形式のタイムスタンプ
     - `event`: "bypass_enabled"
     - `variable`: 環境変数名
     - `taskId`: 実行中のタスクID（存在する場合）
     - `phase`: 実行中のフェーズ（存在する場合）

3. **バイパス使用回数のカウント**
   - 監査ログから過去1時間のバイパス使用回数を集計
   - 閾値（10回）を超えた場合は警告を出力

4. **ログローテーション**
   - ログファイルが10MBを超えたら`.1`, `.2`とローテーション
   - 最大5世代まで保持

**受け入れ基準:**

```bash
# AC-4.1: バイパス環境変数を設定してコマンド実行
export SKIP_PHASE_GUARD=true
workflow_next

# 監査ログに記録される
cat .claude/state/audit-log.jsonl
# → {"timestamp":"2026-02-07T10:00:00Z","event":"bypass_enabled","variable":"SKIP_PHASE_GUARD","taskId":"task123","phase":"implementation"}

# AC-4.2: 複数のバイパスを短時間で使用
export SKIP_SPEC_GUARD=true SKIP_LOOP_DETECTION=true
# → Warning: "Multiple bypasses detected (3 in last hour). Review .claude/state/audit-log.jsonl"

# AC-4.3: 閾値超過
# 1時間に11回のバイパス使用
# → Warning: "Bypass usage exceeded threshold (11 > 10 in last hour). Potential misuse detected."

# AC-4.4: ログローテーション
ls -lh .claude/state/
# → audit-log.jsonl (9.8MB)
# → audit-log.jsonl.1 (10.1MB)
# → audit-log.jsonl.2 (10.0MB)
```

**ログフォーマット例:**

```jsonl
{"timestamp":"2026-02-07T09:00:00.123Z","event":"bypass_enabled","variable":"SKIP_PHASE_GUARD","taskId":"task123","phase":"implementation"}
{"timestamp":"2026-02-07T09:05:30.456Z","event":"bypass_enabled","variable":"FAIL_OPEN","taskId":"task123","phase":"testing"}
{"timestamp":"2026-02-07T09:10:15.789Z","event":"bypass_threshold_exceeded","count":11,"window":"1h"}
```

**変更対象ファイル:**
- 新規ファイル: `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/audit/logger.ts`（監査ログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`（SKIP_PHASE_GUARD検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/spec-first-guard.js`（SKIP_SPEC_GUARD検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/loop-detector.js`（SKIP_LOOP_DETECTION検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`（SKIP_ARTIFACT_CHECK検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-test-first.js`（SKIP_TEST_FIRST_CHECK検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-spec-sync.js`（SKIP_SPEC_SYNC_CHECK検出時にログ記録）
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`（SKIP_DESIGN_VALIDATION検出時にログ記録）

---

## 3. 非機能要件

### NFR-1: パフォーマンス

- AST解析: ファイルあたり平均100ms以内（1000行程度のコード）
- import解析: ファイルあたり平均50ms以内
- 監査ログ書き込み: 同期処理、10ms以内
- スコープ検証: ファイル100個の場合でも3秒以内

### NFR-2: 互換性

- Node.js 18以上
- TypeScript 5.x
- 既存のワークフロー状態データ構造を破壊しない

### NFR-3: エラーハンドリング

- ファイルシステムエラー（ディスク容量不足等）時は警告のみ（ブロックしない）
- AST解析エラー時はフォールバック（正規表現ベースの検証）
- 監査ログ書き込み失敗時は標準エラー出力に出力して継続

### NFR-4: ログ管理

- 監査ログは`.gitignore`に追加（機密情報を含む可能性）
- ログローテーション: 10MB × 5世代（最大50MB）
- ログは追記のみ（上書きしない）

---

## 4. 変更対象ファイル一覧

### 4.1 修正対象の既存ファイル

| ファイル | 変更内容 | 関連REQ |
|---------|---------|---------|
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/record-test-result.ts` | テスト出力整合性チェック追加 | REQ-1 |
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts` | AST解析による構造的検証追加 | REQ-2 |
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts` | ファイル存在チェック、依存関係警告追加 | REQ-3 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js` | 監査ログ記録追加 | REQ-4 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/spec-first-guard.js` | 監査ログ記録追加 | REQ-4 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/loop-detector.js` | 監査ログ記録追加 | REQ-4 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js` | 監査ログ記録追加 | REQ-4 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-test-first.js` | 監査ログ記録追加 | REQ-4 |
| `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-spec-sync.js` | 監査ログ記録追加 | REQ-4 |

### 4.2 新規作成ファイル

| ファイル | 目的 | 関連REQ |
|---------|-----|---------|
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/ast-analyzer.ts` | TypeScript AST解析ロジック | REQ-2 |
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/dependency-analyzer.ts` | import文解析、依存関係抽出 | REQ-3 |
| `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/audit/logger.ts` | 監査ログ記録機能 | REQ-4 |

### 4.3 テストファイル

以下のテストファイルを新規作成または更新:

- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/__tests__/record-test-result-enhanced.test.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/__tests__/ast-analyzer.test.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/__tests__/dependency-analyzer.test.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/audit/__tests__/logger.test.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/__tests__/set-scope-enhanced.test.ts`

---

## 5. スコープ外の事項

以下は今回の対応範囲外とする:

### 5.1 構造的弱点（優先度B）

- **B1**: implementation/refactoring/parallel_qualityで全ファイル編集可能な問題
- **B2**: Bashコマンドの迂回（base64, 変数間接参照, 別言語）
- **B3**: ループ検出がファイル間ローテーションを検出不能
- **B4**: 成果物チェックが警告止まり
- **B5**: parallel_qualityのbuild_checkでスコープ外ファイル編集可能

これらは別タスクで対応する。

### 5.2 機能追加

- 新しいフェーズの追加
- ワークフロー定義の変更
- 新しいMCPツールの追加
- UIの提供（CLIのみ）

### 5.3 外部連携

- GitHubとの連携強化
- CI/CDとの統合
- 外部APIの呼び出し

---

## 6. リスクと制約

### 6.1 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| AST解析のパフォーマンス低下 | 中 | ファイルサイズ閾値設定、フォールバック実装 |
| TypeScript Compiler APIの破壊的変更 | 低 | バージョン固定、互換性テスト |
| 監査ログのディスク消費 | 低 | ローテーション（50MB上限） |
| 依存関係解析の複雑性 | 中 | 相対import/エイリアスのみ対象 |

### 6.2 制約

- **後方互換性**: 既存のタスク状態データ構造を維持
- **実行環境**: Node.js 18以上、Linux/macOS/WSL2
- **パフォーマンス**: AST解析は大規模ファイル（10,000行以上）には適用しない
- **依存解析**: TypeScript/JavaScriptファイルのみ対象（JSON, YAMLは対象外）

---

## 7. テスト戦略

### 7.1 ユニットテスト

各機能要件に対応するユニットテストを作成:

- REQ-1: `record-test-result-enhanced.test.ts` → 10ケース以上
- REQ-2: `ast-analyzer.test.ts` → 15ケース以上
- REQ-3: `dependency-analyzer.test.ts` → 10ケース以上
- REQ-4: `logger.test.ts` → 8ケース以上

### 7.2 統合テスト

実際のワークフロー実行における動作確認:

1. **テスト結果偽造の防止**: AIが誤った結果を記録できないことを確認
2. **設計検証**: 空のクラス/メソッドでパスしないことを確認
3. **スコープ検証**: 架空のファイルでスコープ設定できないことを確認
4. **監査ログ**: バイパス使用が確実に記録されることを確認

### 7.3 回帰テスト

既存の正常系動作が壊れていないことを確認:

- 正常なテスト結果記録が引き続き動作
- 正常な設計検証が引き続きパス
- 正常なスコープ設定が引き続き動作
- 通常のワークフロー実行（バイパスなし）に影響がない

---

## 8. 実装順序

以下の順序で実装を行う:

### Phase 1: 基盤整備
1. 監査ログ機能の実装（REQ-4） → 他の機能の土台
2. AST解析基盤の実装（REQ-2の一部） → 他の機能で再利用可能

### Phase 2: 検証強化
3. テスト結果整合性チェック（REQ-1） → 独立、影響範囲小
4. 設計検証の強化（REQ-2） → AST解析基盤を利用

### Phase 3: スコープ制御
5. スコープ存在チェック（REQ-3.1） → 独立、シンプル
6. 依存関係解析（REQ-3.2） → より高度

### Phase 4: 監査統合
7. 全フックへの監査ログ記録追加（REQ-4） → 横断的変更
8. バイパス使用回数の監視と警告（REQ-4） → 最終統合

---

## 9. 成功基準

本要件が正常に実装されたと判断する基準:

### 9.1 機能基準

- [ ] REQ-1: テスト出力の整合性チェックでAC-1.1〜1.4が全てパス
- [ ] REQ-2: AST解析による検証でAC-2.1〜2.6が全てパス
- [ ] REQ-3: スコープ検証でAC-3.1〜3.7が全てパス
- [ ] REQ-4: 監査ログ記録でAC-4.1〜4.4が全てパス

### 9.2 品質基準

- [ ] ユニットテストカバレッジ: 新規コードの80%以上
- [ ] 全ユニットテストが成功
- [ ] 統合テストで異常系が正しくブロックされる
- [ ] 回帰テストで既存機能が正常動作

### 9.3 非機能基準

- [ ] AST解析: 1000行のファイルで100ms以内
- [ ] 監査ログ書き込み: 10ms以内
- [ ] スコープ検証: 100ファイルで3秒以内
- [ ] 監査ログローテーション: 10MB × 5世代で正常動作

---

## 10. 用語集

| 用語 | 定義 |
|------|------|
| AST | Abstract Syntax Tree（抽象構文木）。ソースコードを構造化して表現したデータ |
| FAIL_CLOSED | エラー時に処理を停止する安全側の動作 |
| FAIL_OPEN | エラー時に処理を継続する危険側の動作 |
| バイパス | セキュリティチェックや検証をスキップする機能 |
| 監査ログ | システムの動作履歴を記録するログ（改ざん不可、追記のみ） |
| スコープ | ワークフローフェーズで編集が許可されるファイル/ディレクトリの範囲 |
| 依存関係 | あるファイルが別のファイルを必要とする関係（import文で表現） |
| 孤立ノード | 他のノードと接続されていないノード（ステートマシン/フローチャート） |

---

## 11. 参考資料

- `docs/workflows/ワ-クフロ-1000万行対応強化/research.md`: 調査結果
- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- JSON Lines: https://jsonlines.org/
- Fail-Safe vs Fail-Secure: https://en.wikipedia.org/wiki/Fail-safe

---

**文書作成日**: 2026-02-07
**作成者**: AI Agent (requirements フェーズ)
**バージョン**: 1.0
**次のフェーズ**: parallel_analysis (threat_modeling + planning)
