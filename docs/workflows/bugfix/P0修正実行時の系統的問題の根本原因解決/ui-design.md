## サマリー

本ドキュメントはP0修正実行時の系統的問題（FR-1〜FR-4）に対応するMCPサーバーのインターフェース設計書である。
対象システムはGUIを持たないCLIツール（MCPサーバー）であり、設計の主眼はMCPツールの入出力形式・エラーメッセージフォーマット・APIレスポンス構造・設定ファイル構造に置く。

### 目的

- FR-1: コードブロック除外後のバリデーション結果をOrchestratorに正確に伝えるエラーメッセージ形式の策定
- FR-2: モデルエスカレーション提案フィールドを含むbuildRetryPromptレスポンス形式の策定
- FR-3: isCompoundWordContext判定結果とハッシュポリシー緩和を反映したrecord_test_resultレスポンス設計
- FR-4: ベースライン未設定時の確認メッセージおよびforceTransitionパラメータの入力スキーマ設計

### 主要な決定事項

- MCPツール応答はJSONオブジェクト形式とし、successフィールドとmessageフィールドを必須項目とする
- FR-2のsuggestModelEscalationはオプショナルフィールドとして既存応答形式に追加する
- FR-4のrequiresConfirmationはsuccess: falseの応答にのみ付与し、success: trueの場合は省略する
- エラーメッセージは日本語で提供し、修正ガイダンスを本文内に含める

### 次フェーズで必要な情報

- artifact-validator.tsの既存エラーメッセージ文字列（修正前後の差分を記録するため）
- record-test-result.tsが現在返却するsuccessレスポンスのフィールド構成
- next.tsのworkflowNext関数が現在返却するJSONレスポンスの正確なフィールド構成

---

## CLIインターフェース設計

### 概要

このシステムのユーザーインターフェースはMCPツール呼び出しの形式で提供される。
Orchestratorは各フェーズの移行・記録・リトライ判定をMCPツール経由でMCPサーバーに委譲し、MCPサーバーが状態を更新して結果を返す。
FR-1〜FR-4の修正により変更・追加されるMCPツールのインターフェースを以下に定義する。

### workflow_next ツール（FR-4追加）

**ツール名**: `workflow_next`

**目的**: 現在のフェーズを完了し次のフェーズへ遷移する。testing→regression_test遷移時にFR-4のベースラインチェックを実行する。

**入力スキーマ（FR-4追加分を含む）**:

```typescript
{
  taskId?: string;              // タスクID（省略時はアクティブタスクを使用）
  sessionToken?: string;        // Orchestratorセッショントークン
  forceTransition?: boolean;    // ベースライン未設定を無視して遷移する（新規プロジェクト用）
}
```

forceTransitionの型はboolean、デフォルト値はfalseであり、省略した場合はfalseとして扱う。
新規プロジェクトでtestitngフェーズ後にregression_testに遷移する際、既存テストスイートが存在しない場合はforceTransition: trueを指定することで確認ダイアログを回避できる。

**出力スキーマ（通常遷移）**:

```typescript
{
  success: true;
  nextPhase: string;            // 遷移先フェーズ名
  message: string;              // 遷移完了メッセージ
}
```

**出力スキーマ（ベースライン未設定時、FR-4）**:

```typescript
{
  success: false;
  message: string;              // 警告メッセージ（日本語）
  requiresConfirmation: true;   // 確認が必要であることを示すフラグ
  hint: string;                 // 解決手順を含むヒントメッセージ
}
```

### workflow_complete_sub ツール（FR-1バリデーション結果反映）

**ツール名**: `workflow_complete_sub`

**目的**: 並列フェーズのサブフェーズを完了としてマークする。成果物バリデーションを実行し、失敗時にFR-1のコードブロック除外結果を含む詳細エラーを返す。

**入力スキーマ**:

```typescript
{
  taskId?: string;
  subPhase: string;             // 完了するサブフェーズ名
  sessionToken?: string;
}
```

**出力スキーマ（バリデーション失敗時、FR-1対応）**:

```typescript
{
  success: false;
  validationErrors: {
    type: 'forbidden_pattern' | 'bracket_placeholder' | 'duplicate_lines' | 'missing_section' | 'density_low';
    message: string;
    affectedLines?: string[];   // 問題のある行の抜粋（コードブロック外の行のみ）
    codeBlocksExcluded: number; // 除外されたコードブロック数（FR-1の透明性確保）
  }[];
  retryPrompt: BuildRetryResult; // FR-2のエスカレーション情報を含む
}
```

### workflow_capture_baseline ツール（FR-4関連）

**ツール名**: `workflow_capture_baseline`

**目的**: researchフェーズまたはtestingフェーズでテスト実行結果をベースラインとして記録する。FR-4の遷移チェックで参照される。

**入力スキーマ**:

```typescript
{
  taskId: string;
  totalTests: number;           // テスト総数
  passedTests: number;          // 成功テスト数
  failedTests: string[];        // 失敗テスト名の配列
}
```

**出力スキーマ**:

```typescript
{
  success: true;
  baselineId: string;           // 記録されたベースラインの識別子
  recordedAt: string;           // 記録日時（ISO 8601形式）
  summary: string;              // 記録内容のサマリーメッセージ
}
```

### record_test_result ツール（FR-3対応）

**ツール名**: `record_test_result`

**目的**: テストフェーズ（testingまたはregression_test）でのテスト実行結果を記録する。FR-3のハッシュポリシーにより、regression_testフェーズでは同一ハッシュの再記録が許可される。

**入力スキーマ**:

```typescript
{
  taskId: string;
  exitCode: number;             // テスト実行の終了コード（0=成功）
  output: string;               // テスト実行出力（50文字以上必須）
  summary?: string;             // テスト結果のサマリー
  sessionToken?: string;
}
```

**出力スキーマ（成功時）**:

```typescript
{
  success: true;
  message: string;
  phase: string;                // 記録時のフェーズ名（'testing'または'regression_test'）
  hashPolicy: 'strict' | 'relaxed'; // FR-3: testingはstrict、regression_testはrelaxed
}
```

---

## エラーメッセージ設計

### FR-1: コードブロック除外バリデーションエラーメッセージ

FR-1の修正後、バリデーターはコードブロック外の行のみを検査対象とする。
エラーメッセージにはコードブロックが除外された旨を明記し、Orchestratorがリトライプロンプトを適切に生成できるようにする。

**禁止パターン検出エラー（FR-1適用後）**:

```
成果物バリデーションエラー（禁止パターン検出）
検出パターン: "作業中を示す英略語"
検出箇所: コードブロック外のテキスト行（42行目付近）
コードブロック除外結果: 3個のコードブロック（18行分）が検査対象外として除外されました
修正方法: 検出されたパターンをコードブロック外のテキストから削除してください
          コードブロック内の同パターンは検出対象外であり、削除不要です
```

**角括弧プレースホルダー検出エラー（FR-1適用後）**:

```
成果物バリデーションエラー（角括弧プレースホルダー検出）
検出パターン: "{変数名}" に一致する表現
検出箇所: コードブロック外のテキスト（67行目付近）
コードブロック除外結果: 5個のコードブロック（32行分）が検査対象外として除外されました
修正方法: 角括弧プレースホルダーを波括弧形式（{変数名}）に変更するか、
          コードブロック内に移動してください
```

上記2種類のエラーメッセージには必ず「コードブロック除外結果」行を含め、除外されたコードブロック数と行数を明示する。
これによりOrchestratorがエラーの根拠を理解でき、適切な修正指示をsubagentに渡すことができる。

### FR-2: モデルエスカレーション提案メッセージ

buildRetryPromptがsuggestModelEscalation: trueを返す条件（リトライ2回目以降かつ複数エラー同時発生）に達した場合、Orchestratorへのエスカレーション提案メッセージを含める。

**エスカレーション提案を含むリトライ失敗通知**:

```
バリデーションリトライ失敗（2回目）
発生エラー数: 4件（禁止パターン2件、密度不足1件、必須セクション欠落1件）
モデルエスカレーション提案: true
推奨アクション: 次のリトライではモデルをsonnetに変更してsubagentを再起動してください
               （haikuで複数回失敗が継続しています。sonnetはより複雑な修正指示の解釈が得意です）
```

**エスカレーション提案なし（1回目リトライ）**:

```
バリデーションリトライ失敗（1回目）
発生エラー数: 2件（禁止パターン1件、密度不足1件）
モデルエスカレーション提案: false
推奨アクション: 同一モデルで再試行してください（修正指示を具体化することを推奨します）
```

### FR-3: 複合語コンテキスト検出メッセージ

isCompoundWordContextによる複合語判定が適用される場合、record_test_resultのBLOCKING_FAILURE_KEYWORDS処理がスキップされたことを応答に含める。

**複合語スキップ通知（成功時）**:

```
テスト結果を記録しました
注記: "Fail Closed" を含む出力を検出しましたが、複合語コンテキスト判定により
     BLOCKING_FAILURE_KEYWORDSとして扱わず記録を許可しました
記録フェーズ: regression_test
ハッシュポリシー: relaxed（同一ハッシュの再記録が許可されています）
```

**ハッシュ重複時のフェーズ別メッセージ**:

testingフェーズで同一ハッシュを検出した場合（従来通り拒否）:
```
テスト結果記録エラー（ハッシュ重複）
フェーズ: testing（strict ハッシュポリシー）
同一の出力が既に記録済みです。テスト結果が変化していない可能性があります
解決手順: テストを再実行して異なる出力を得るか、実装を修正してください
```

regression_testフェーズで同一ハッシュを検出した場合（FR-3により許可）:
```
テスト結果を記録しました（ハッシュ重複を上書き）
フェーズ: regression_test（relaxed ハッシュポリシー）
前回記録と同一の出力が検出されましたが、regression_testフェーズでは再記録を許可します
用途: ベースラインとの比較のため修正前後の同一結果の記録が必要な場合に使用されます
```

### FR-4: ベースライン未設定時の警告メッセージ

testingフェーズからregression_testへの遷移時にtaskState.testBaselineが未設定の場合、以下の警告メッセージを返す。

**ベースライン未設定警告**:

```
フェーズ遷移に確認が必要です
現在フェーズ: testing → 遷移先: regression_test
警告: ベースライン（変更前のテスト結果）が記録されていません
     ベースラインがないと、修正前後のテスト比較が不可能となります

解決手順:
  1. workflow_capture_baseline を呼び出してベースラインを記録してください
     例: workflow_capture_baseline({ taskId: "xxx", totalTests: 820, passedTests: 820, failedTests: [] })
  2. 記録完了後、再度 workflow_next を呼び出してください

新規プロジェクト（既存テストなし）の場合:
  forceTransition: true を指定することでベースラインチェックをスキップできます
  例: workflow_next({ forceTransition: true })
```

---

## APIレスポンス設計

### BuildRetryResult型定義（FR-2）

definitions.tsのbuildRetryPrompt関数の返り値型を以下のように定義する。

```typescript
interface BuildRetryResult {
  prompt: string;                      // リトライ用プロンプト本文
  suggestModelEscalation?: boolean;    // モデルエスカレーション提案フラグ（省略時はfalse扱い）
  retryCount: number;                  // 現在のリトライ回数
  recommendedModel?: 'haiku' | 'sonnet' | 'opus'; // エスカレーション時の推奨モデル
  errorSummary: {                      // エラー集計情報
    totalErrors: number;
    errorTypes: string[];
  };
}
```

suggestModelEscalationがtrueの場合、recommendedModelは必ず'sonnet'を設定する。
haikuからsonnetへのエスカレーションのみを対象とし、sonnetからopusへのエスカレーションはFR-2の範囲外とする。

### workflow_next レスポンス（FR-4追加フィールド）

```typescript
// 通常遷移成功時
interface WorkflowNextSuccessResponse {
  success: true;
  nextPhase: string;
  message: string;
  taskId: string;
}

// ベースライン未設定による確認要求時（FR-4）
interface WorkflowNextConfirmationResponse {
  success: false;
  message: string;
  requiresConfirmation: true;
  hint: string;
  currentPhase: string;
  targetPhase: string;
}
```

requiresConfirmationフィールドはsuccess: falseの応答にのみ付与する。
success: trueの応答にrequiresConfirmationを含めることは禁止とし、型定義上も別の型として分離する。

### record_test_result レスポンス（FR-3追加フィールド）

```typescript
// 成功時レスポンス
interface RecordTestResultSuccessResponse {
  success: true;
  message: string;
  phase: 'testing' | 'regression_test';
  hashPolicy: 'strict' | 'relaxed';        // FR-3: フェーズによる使い分け
  compoundWordSkipped?: boolean;            // FR-3: 複合語スキップが発生した場合のみ付与
  compoundWordContext?: string;             // スキップされた複合語の文脈情報
}

// 失敗時レスポンス（testingフェーズでのハッシュ重複）
interface RecordTestResultHashDuplicateResponse {
  success: false;
  message: string;
  errorCode: 'HASH_DUPLICATE';
  phase: 'testing';                         // testingフェーズでのみ発生
  hashPolicy: 'strict';
}
```

### artifact-validator バリデーション結果（FR-1追加フィールド）

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  codeBlocksExcluded?: number;             // FR-1: 除外されたコードブロック数
  nonCodeLineCount?: number;               // FR-1: 検査対象となったコードブロック外行数
}

interface ValidationError {
  type: 'forbidden_pattern' | 'bracket_placeholder' | 'duplicate_lines'
       | 'missing_section' | 'section_density_low' | 'insufficient_lines';
  message: string;
  details?: string;
  affectedContent?: string;               // 問題箇所の抜粋（コードブロック外の行のみ）
}
```

codeBlocksExcludedフィールドはFR-1の修正後に追加され、バリデーション処理でコードブロックが除外されたことをOrchestratorに伝える透明性確保のための情報である。

---

## 設定ファイル設計

### CLAUDE.md リトライテンプレート追記内容（FR-2）

「バリデーション失敗時のリトライプロンプトテンプレート」セクション末尾に以下の内容を追記する。

```markdown
### モデルエスカレーション手順（FR-2追加）

buildRetryPromptの返り値に `suggestModelEscalation: true` が含まれる場合、
次のリトライでは模型をsonnetに変更してsubagentを再起動すること。

条件:
- リトライ2回目以降でsuggestModelEscalation: trueが返された場合にのみ適用
- 1回目のリトライでは常にsuggestModelEscalation: falseが返されるため、変更不要

エスカレーション時のTask tool呼び出し変更方法:
```
// エスカレーション前（haiku）
Task({ prompt: retryPrompt.prompt, model: 'haiku', description: '...リトライ1回目' })

// エスカレーション後（sonnet）
Task({ prompt: retryPrompt.prompt, model: 'sonnet', description: '...リトライ2回目（エスカレーション）' })
```

haikuで2回以上リトライが失敗し、suggestModelEscalation: trueが返された場合は
自動的にsonnetへエスカレーションする。sonnetへのエスカレーション後もバリデーション失敗が
継続する場合は、Orchestratorが成果物を読み込んで問題箇所を特定し、
行番号レベルの修正指示をリトライプロンプトに含めること（ルール21参照）。
```

追記はリトライカウント管理の説明の直後に配置し、既存のリトライプロンプト形式の説明を変更しない。
workflow-plugin/CLAUDE.mdにも同一内容を追記して両ファイルの同期状態を維持する。

### definitions.ts researchフェーズプロンプト追記内容（FR-4）

researchフェーズのbuildPrompt関数が生成するプロンプトに以下の指示ブロックを追加する。
追加位置はresearchフェーズの「作業内容」セクション末尾とする。

```typescript
// definitions.ts内のresearchフェーズプロンプト追記部分（イメージ）
const baselineInstruction = `
## ★重要★ テストベースライン記録（FR-4対応）

既存のテストスイートが存在する場合は、researchフェーズ中に以下の手順でベースラインを記録すること。

手順:
1. テストを実行して現在の状態を確認する
   例: cd workflow-plugin/mcp-server && npm test 2>&1 | head -50
2. 実行結果（総数・成功数・失敗テスト名）を確認する
3. workflow_capture_baselineを呼び出してベースラインを記録する
   例: workflow_capture_baseline({
         taskId: "{taskId}",
         totalTests: 820,
         passedTests: 820,
         failedTests: []
       })

ベースライン未記録のままtestingフェーズを完了すると、
regression_testフェーズへの遷移時に確認ダイアログが表示されます。
新規プロジェクト（既存テストなし）の場合は記録不要です。
`;
```

追加するプロンプト指示ブロックは既存のresearchフェーズプロンプト文字列の末尾に連結し、既存の指示内容を削除・変更しない設計とする。

### workflow_next MCPツール定義追加（FR-4）

server.tsまたはtools/index.tsのworkflow_nextツール定義のinputSchemaを以下のように更新する。

```typescript
// workflow_next ツール定義（FR-4追加分）
{
  name: 'workflow_next',
  description: '現在のフェーズを完了して次のフェーズへ遷移する。testing→regression_test遷移時はベースライン存在チェックを実施する。',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'タスクID（省略時はアクティブタスクを使用）',
      },
      sessionToken: {
        type: 'string',
        description: 'Orchestratorセッショントークン（REQ-6認証用）',
      },
      forceTransition: {                   // FR-4追加
        type: 'boolean',
        description: 'ベースライン未設定を無視してregression_testに遷移する（新規プロジェクト用）',
      },
    },
  },
}
```

forceTransitionパラメータはrequiredリストに追加しない（オプショナル扱い）。
既存の呼び出し元コードがforceTransitionを指定しなくても動作を維持することがNFR-3の要件であるため、この設計は後方互換性を保証する。
