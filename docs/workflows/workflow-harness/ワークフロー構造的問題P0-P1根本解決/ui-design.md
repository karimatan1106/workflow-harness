# UI設計 - ワークフロー構造的問題P0-P1根本解決

## サマリー

本UI設計書は、6つの新規MCPツールおよび関数のCLIインターフェース、APIレスポンス、エラーメッセージを詳細に定義する。
本タスクはMCPサーバーのツール追加であり、GUIではなくMCPプロトコル経由のツール呼び出しとJSON応答が中心となる。
各ツールのパラメータ検証ルールとエラーメッセージの日本語対応方針を明確化する。
成功時と失敗時のレスポンス構造を具体例付きで示し、Orchestratorによる適切なハンドリングを可能にする。
環境変数による動作制御では、検証厳格性やパス設定の柔軟性を提供する。
次フェーズで必要な情報として、各ツールのMCPツール定義構造やTypeScript型定義、エラーハンドリングパターンを記載する。
これによりtest_designフェーズでのテストケース設計とtest_implフェーズでのモック応答作成が効率化される。

## CLIインターフェース設計

本セクションでは各MCPツールのパラメータ仕様と呼び出し方法を定義する。
MCPツールはJSON-RPC経由で呼び出され、全パラメータはオブジェクト形式で渡される。
必須パラメータが欠けている場合はバリデーションエラーが返却される。
オプショナルパラメータが省略された場合はデフォルト値が適用される。
以下に6つのツールおよび関数の詳細仕様を示す。

### 1. workflow_pre_validate - 成果物事前検証ツール

#### ツール呼び出し形式

```typescript
const result = await mcp.callTool('workflow_pre_validate', {
  taskId?: string,
  targetPhase: string,
  filePath: string,
  sessionToken?: string
});
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| taskId | string | × | 対象タスクID | UUID形式 | アクティブタスク |
| targetPhase | string | ○ | 検証対象フェーズ名 | 有効なフェーズ名 | なし |
| filePath | string | ○ | 検証対象ファイルパス | 相対/絶対パス | なし |
| sessionToken | string | × | セッショントークン | 英数字64文字 | なし |

#### 使用例（成功ケース）

```typescript
// requirements.mdの事前検証
const result = await mcp.callTool('workflow_pre_validate', {
  targetPhase: 'requirements',
  filePath: 'docs/workflows/タスク名/requirements.md'
});
```

#### 使用例（エラーケース）

```typescript
// ファイルが存在しない場合
const result = await mcp.callTool('workflow_pre_validate', {
  targetPhase: 'spec',
  filePath: 'docs/workflows/タスク名/missing.md'
});
// result.passed === false
// result.passed は false になり、errors配列の先頭に「指定されたファイルが見つかりません」が格納される
```

---

### 2. workflow_record_feedback - フィードバック記録ツール

#### ツール呼び出し形式

```typescript
const result = await mcp.callTool('workflow_record_feedback', {
  taskId?: string,
  feedback: string,
  appendMode?: boolean,
  sessionToken?: string
});
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| taskId | string | × | 対象タスクID | UUID形式 | アクティブタスク |
| feedback | string | ○ | フィードバック内容 | 1文字以上10000文字以内 | なし |
| appendMode | boolean | × | 追記モード | true時は追記 | false（置換） |
| sessionToken | string | × | セッショントークン | 英数字64文字 | なし |

#### 使用例（置換モード）

```typescript
// userIntentを完全に置き換える
const result = await mcp.callTool('workflow_record_feedback', {
  feedback: '要件定義段階でエラーハンドリングを重視してください。',
  appendMode: false
});
```

#### 使用例（追記モード）

```typescript
// 既存userIntentに追記
const result = await mcp.callTool('workflow_record_feedback', {
  feedback: '実装時はパフォーマンステストも追加してください。',
  appendMode: true
});
```

---

### 3. validateKeywordTraceability - キーワードトレーサビリティ検証関数

この関数は内部関数であり、MCPツールとして公開されない。workflow_next内で自動的に呼び出される。

#### 関数シグネチャ

```typescript
function validateKeywordTraceability(
  docsDir: string,
  sourcePhase: 'requirements' | 'spec' | 'test-design',
  targetPhase: 'spec' | 'test-design' | 'implementation',
  minCoverage: number = 0.8
): KeywordTraceabilityResult;
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| docsDir | string | ○ | ドキュメントディレクトリパス | 絶対パス | なし |
| sourcePhase | string | ○ | トレース元フェーズ | 限定列挙 | なし |
| targetPhase | string | ○ | トレース先フェーズ | 限定列挙 | なし |
| minCoverage | number | × | 最低カバレッジ | 0.0～1.0 | 0.8 |

#### 呼び出しタイミング

| フェーズ遷移 | sourcePhase | targetPhase | 検証内容 |
|------------|-------------|-------------|---------|
| requirements → parallel_analysis | requirements | spec | 要件定義のキーワードが仕様書で参照されているか |
| test_design → test_impl | spec | test-design | 仕様書のキーワードがテスト設計で言及されているか |
| implementation → refactoring | test-design | implementation | テスト設計のキーワードが実装コードで使用されているか |

---

### 4. parseCLAUDEMdByPhase - CLAUDE.md分割配信パーサー

この関数は内部関数であり、MCPツールとして公開されない。resolvePhaseGuide内で自動的に呼び出される。

#### 関数シグネチャ

```typescript
function parseCLAUDEMdByPhase(
  claudeMdPath: string,
  phaseName: string
): ParseResult;
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| claudeMdPath | string | ○ | CLAUDE.mdファイルパス | 絶対パス | なし |
| phaseName | string | ○ | フェーズ名 | 有効なフェーズ名 | なし |

#### セクションマッピング例

各フェーズに対してCLAUDE.mdから抽出するセクション見出しのマッピングは以下の通りである。

researchフェーズでは「調査フェーズ」「AIへの厳命1」「AIへの厳命2」の3セクションを抽出する。
requirementsフェーズでは「要件定義フェーズ」「AIへの厳命2」「AIへの厳命3」の3セクションを抽出する。
planningフェーズでは「仕様書作成フェーズ」「AIへの厳命4」「AIへの厳命5」の3セクションを抽出する。
implementationフェーズでは「実装フェーズ」「AIへの厳命16」「AIへの厳命17」の3セクションを抽出する。
commitフェーズでは「コミットルール」「完了宣言ルール」の2セクションを抽出する。

---

### 5. workflow_create_subtask - サブタスク作成ツール

#### ツール呼び出し形式

```typescript
const result = await mcp.callTool('workflow_create_subtask', {
  parentTaskId: string,
  subtaskName: string,
  taskSize?: 'small' | 'medium' | 'large',
  sessionToken?: string
});
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| parentTaskId | string | ○ | 親タスクID | UUID形式 | なし |
| subtaskName | string | ○ | サブタスク名 | 1文字以上100文字以内 | なし |
| taskSize | string | × | タスクサイズ | small/medium/large | medium |
| sessionToken | string | × | セッショントークン | 英数字64文字 | なし |

#### 使用例（成功ケース）

```typescript
// 親タスク配下にサブタスクを作成
const result = await mcp.callTool('workflow_create_subtask', {
  parentTaskId: '20260208_100521',
  subtaskName: 'データベース設計',
  taskSize: 'medium'
});
```

---

### 6. workflow_link_tasks - タスクリンクツール

#### ツール呼び出し形式

```typescript
const result = await mcp.callTool('workflow_link_tasks', {
  parentTaskId: string,
  childTaskId: string,
  sessionToken?: string
});
```

#### パラメータ詳細

| パラメータ名 | 型 | 必須 | 説明 | 制約 | デフォルト値 |
|------------|---|------|------|------|------------|
| parentTaskId | string | ○ | 親タスクID | UUID形式、childTaskIdと異なること | なし |
| childTaskId | string | ○ | 子タスクID | UUID形式、parentTaskIdと異なること | なし |
| sessionToken | string | × | セッショントークン | 英数字64文字 | なし |

#### 使用例（成功ケース）

```typescript
// 既存の2タスクを親子関係でリンク
const result = await mcp.callTool('workflow_link_tasks', {
  parentTaskId: '20260208_100521',
  childTaskId: '20260208_104500'
});
```

#### 使用例（循環参照エラー）

```typescript
// 子タスクの子孫に親タスクが既に存在する場合
const result = await mcp.callTool('workflow_link_tasks', {
  parentTaskId: '20260208_100521',
  childTaskId: '20260208_093000' // この子の祖先に20260208_100521が含まれる
});
// result.success === false
// result.message === '循環参照が検出されたためリンクできません。祖先チェーン: ...'
```

---

## エラーメッセージ設計

本セクションでは各ツールが返却するエラーメッセージの一覧と設計方針を定義する。
エラーメッセージは日本語を基本とし、エラーコードは英大文字とアンダースコアで構成する。
各エラーメッセージには発生条件と回復方法を明記し、Orchestratorが適切な対処を選択できるようにする。
警告メッセージは環境変数による寛容モード設定時にエラーの代わりに返却される。
将来的な国際化対応のため、メッセージ本文とは別にエラーコード定数を管理する設計とする。

### エラーメッセージフォーマット原則

全てのエラーメッセージは以下の構造を持つ。

```
<エラー内容>: <詳細情報>
```

日本語メッセージを基本とし、内部的にはエラーコードも保持する。将来的な国際化対応のため、エラーコードは定数として定義する。

---

### workflow_pre_validate エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| FILE_NOT_FOUND | 指定されたファイルが見つかりません: {filePath} | filePathのファイルが存在しない | ファイルパスを確認する |
| PHASE_NOT_FOUND | フェーズ定義が見つかりません: {targetPhase} | targetPhaseが無効 | 有効なフェーズ名を指定する |
| MISSING_SECTIONS | 必須セクションが不足しています: {sectionNames} | requiredSectionsが欠けている | 成果物に不足セクションを追加する |
| MIN_LINES_NOT_MET | 最低行数要件を満たしていません: 現在{current}行、必要{required}行 | minLinesに達していない | 成果物の内容を充実させる |
| FORBIDDEN_PATTERN | 禁止パターンが検出されました: {patternNames} | 禁止パターンが存在する | 禁止パターンを削除する |
| DUPLICATE_LINES | 重複行が検出されました: {lineContent} | 同一行が3回以上繰り返される | 行を固有の内容に書き換える |
| INVALID_TASK_ID | 指定されたタスクが見つかりません: {taskId} | taskIdに対応するタスクが存在しない | 正しいタスクIDを指定する |
| INVALID_SESSION | セッショントークンが不正です | sessionToken検証失敗 | 有効なトークンを取得して再試行する |

---

### workflow_record_feedback エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| TASK_NOT_FOUND | 指定されたタスクが見つかりません: {taskId} | taskIdに対応するタスクが存在しない | 正しいタスクIDを指定する |
| FEEDBACK_EMPTY | フィードバック内容を入力してください | feedbackが空文字列 | 1文字以上の内容を入力する |
| FEEDBACK_TOO_LONG | フィードバックは10000文字以内で入力してください。現在{length}文字 | feedbackが10000文字超過 | フィードバックを短縮する |
| INVALID_SESSION | セッショントークンが不正です。/workflow statusでトークンを確認してください | sessionToken検証失敗 | 有効なトークンを取得して再試行する |
| SAVE_FAILED | フィードバックの保存に失敗しました: {errorDetail} | ファイル保存エラー | ディスク容量/権限を確認する |

---

### validateKeywordTraceability エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| SOURCE_NOT_FOUND | 要件定義ファイルが見つかりません: {filePath} | sourcePhaseのファイルが存在しない | 前フェーズを完了させる |
| TARGET_NOT_FOUND | 実装ファイルが見つかりません: {filePath} | targetPhaseのファイル/ディレクトリが存在しない | ターゲットファイルを作成する |
| NO_KEYWORDS_EXTRACTED | キーワードが抽出できませんでした: {sourceFile} | ソースドキュメントが空 | ソースドキュメントに実質的内容を追加する |
| LOW_COVERAGE | キーワードカバレッジが不足しています: {coverage}（必要: {minCoverage}） 未参照: {missingKeywords} | coverageがminCoverageを下回る | ターゲットでキーワードを参照する |
| READ_ERROR | ファイルの読み込みに失敗しました: {errorDetail} | ファイルシステムエラー | ファイル権限/エンコーディングを確認する |

---

### parseCLAUDEMdByPhase エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| FILE_NOT_FOUND | CLAUDE.mdファイルが見つかりません: {claudeMdPath} 環境変数CLAUDE_MD_PATHを確認してください | claudeMdPathのファイルが存在しない | CLAUDE.mdファイルを配置する |
| SECTION_NOT_FOUND | 該当セクションが見つかりませんでした: フェーズ={phaseName} セクション={sectionPatterns} | フェーズに対応するセクションが存在しない | CLAUDE.mdに該当セクションを追加する |
| PARSE_ERROR | CLAUDE.mdの形式が不正です: {errorDetail} | Markdown解析エラー | CLAUDE.mdの形式を修正する |
| ENCODING_ERROR | ファイルのエンコーディングが不正です。UTF-8で保存してください | エンコーディングエラー | CLAUDE.mdをUTF-8に変換する |

---

### workflow_create_subtask エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| PARENT_NOT_FOUND | 親タスクが見つかりません: {parentTaskId} タスクIDを確認してください | parentTaskIdに対応するタスクが存在しない | 正しい親タスクIDを指定する |
| NAME_TOO_LONG | サブタスク名は100文字以内で指定してください。現在{length}文字 | subtaskNameが100文字超過 | サブタスク名を短縮する |
| INVALID_SESSION | セッショントークンが不正です。親タスクのセッションを確認してください | sessionToken検証失敗 | 有効なトークンを取得して再試行する |
| SAVE_FAILED | サブタスクの作成に失敗しました: {errorDetail} | TaskState保存エラー | ディスク容量/権限を確認する |
| INVALID_TASK_SIZE | タスクサイズはsmall、medium、largeのいずれかを指定してください | taskSizeが不正 | 有効なtaskSizeを指定する |

---

### workflow_link_tasks エラーメッセージ

| エラーコード | エラーメッセージ（日本語） | 発生条件 | 回復方法 |
|------------|------------------------|---------|---------|
| PARENT_NOT_FOUND | 親タスクが見つかりません: {parentTaskId} | parentTaskIdに対応するタスクが存在しない | 正しい親タスクIDを指定する |
| CHILD_NOT_FOUND | 子タスクが見つかりません: {childTaskId} | childTaskIdに対応するタスクが存在しない | 正しい子タスクIDを指定する |
| SELF_REFERENCE | 同一タスクを親子関係にすることはできません: {taskId} | parentTaskId == childTaskId | 異なるタスクIDを指定する |
| CIRCULAR_REFERENCE | 循環参照が検出されたためリンクできません。祖先チェーン: {ancestorChain} | 子の祖先に親が存在 | タスク構造を見直す |
| ALREADY_LINKED | 既にリンク済みです: 親={parentTaskId} 子={childTaskId} | 既にリンク関係が存在 | 既存リンクを確認する |
| ALREADY_HAS_PARENT | 子タスクは既に他の親タスクにリンクされています: 既存親={existingParentId} | childTaskIdのparentTaskIdが既に設定済み | 既存リンクを解除してから再試行する |
| INVALID_SESSION | セッショントークンが不正です | sessionToken検証失敗 | 有効なトークンを取得して再試行する |
| SAVE_FAILED | タスクのリンクに失敗しました: {errorDetail} | TaskState保存エラー | ディスク容量/権限を確認する |

---

### 警告メッセージ（Warnings）

環境変数により厳格モードが無効の場合、エラーではなく警告として返却されるメッセージ。

| 警告種別 | 警告メッセージ（日本語） | 発生条件 | 推奨アクション |
|---------|------------------------|---------|--------------|
| LENIENT_VALIDATION | フェーズ定義が見つからないため汎用検証のみ実行しました | PhaseGuide定義が存在しない | PhaseGuide定義を追加する |
| LENIENT_PATTERN | 禁止パターンが検出されましたが、警告モードのため許可します: {patternNames} | VALIDATE_DESIGN_STRICT=false | 禁止パターンを削除する |
| LENIENT_COVERAGE | キーワードカバレッジが低いですが、警告モードのため続行します: {coverage} 未参照: {missingKeywords} | SEMANTIC_TRACE_STRICT=false | ターゲットでキーワードを参照する |

---

## APIレスポンス設計

本セクションでは各ツールのJSON応答構造を定義する。
全てのレスポンスはMCPプロトコルのcontent配列内にJSON文字列として格納される。
成功レスポンスにはツール固有の結果フィールドが含まれ、失敗レスポンスにはエラー理由が含まれる。
各ツールの型定義はTypeScript interfaceとして厳密に定義し、実装時の型安全性を保証する。
具体的なJSON応答例を成功パターンと失敗パターンの両方について示す。

### レスポンス構造の原則

全てのMCPツールレスポンスはJSON形式であり、以下の共通構造を持つ。

```typescript
interface BaseResponse {
  success?: boolean;  // 成功/失敗フラグ（任意）
  message?: string;   // 人間可読メッセージ（任意）
}
```

各ツール固有のフィールドは型定義により厳密に管理される。

---

### workflow_pre_validate レスポンス

#### 型定義

```typescript
interface PreValidateResult {
  passed: boolean;
  errors: string[];
  warnings?: string[];
  checkedRules: string[];
  message: string;
}
```

#### 成功レスポンス例

```json
{
  "passed": true,
  "errors": [],
  "warnings": [],
  "checkedRules": [
    "validateSectionsCompleteness",
    "validateMinimumLines",
    "validateNoForbiddenPatterns",
    "validateNoDuplicateLines"
  ],
  "message": "全ての検証に合格しました。requirements.mdは品質基準を満たしています。"
}
```

#### 失敗レスポンス例（セクション不足）

```json
{
  "passed": false,
  "errors": [
    "必須セクションが不足しています: ## 概要, ## システム構成",
    "最低行数要件を満たしていません: 現在42行、必要50行"
  ],
  "warnings": [],
  "checkedRules": [
    "validateSectionsCompleteness",
    "validateMinimumLines"
  ],
  "message": "次の問題が見つかりました: セクション不足、行数不足"
}
```

#### 警告付き成功レスポンス例（寛容モード）

```json
{
  "passed": true,
  "errors": [],
  "warnings": [
    "禁止パターンが検出されましたが、警告モードのため許可します: placeholder_a, placeholder_b"
  ],
  "checkedRules": [
    "validateSectionsCompleteness",
    "validateMinimumLines",
    "validateNoForbiddenPatterns"
  ],
  "message": "検証は合格しましたが、警告があります。詳細はwarningsを確認してください。"
}
```

---

### workflow_record_feedback レスポンス

#### 型定義

```typescript
interface RecordFeedbackResult {
  success: boolean;
  message: string;
  updatedUserIntent?: string;
}
```

#### 成功レスポンス例（置換モード）

```json
{
  "success": true,
  "message": "フィードバックを記録しました。",
  "updatedUserIntent": "要件定義段階でエラーハンドリングを重視してください。"
}
```

#### 成功レスポンス例（追記モード）

```json
{
  "success": true,
  "message": "フィードバックを追記しました。",
  "updatedUserIntent": "要件定義段階でエラーハンドリングを重視してください。\n\n実装時はパフォーマンステストも追加してください。"
}
```

#### 失敗レスポンス例（文字数超過）

```json
{
  "success": false,
  "message": "フィードバックは10000文字以内で入力してください。現在12500文字"
}
```

---

### validateKeywordTraceability レスポンス

#### 型定義

```typescript
interface KeywordTraceabilityResult {
  passed: boolean;
  coverage: number;
  missingKeywords: string[];
  errors: string[];
  warnings?: string[];
}
```

#### 成功レスポンス例

```json
{
  "passed": true,
  "coverage": 0.92,
  "missingKeywords": [],
  "errors": [],
  "warnings": []
}
```

#### 失敗レスポンス例（カバレッジ不足）

カバレッジ不足時のレスポンスでは、passedがfalse、coverageが0.65、missingKeywordsに未参照キーワード5件が格納される。
errorsには「キーワードカバレッジが不足しています: 0.65（必要: 0.8）」というメッセージと未参照キーワード名が列挙される。

#### 警告付き成功レスポンス例（寛容モード）

SEMANTIC_TRACE_STRICTがfalseの場合、passedはtrueのまま保持され、warningsに警告メッセージが格納される。
coverageが0.65でmissingKeywordsに未参照キーワード2件が格納されるが、エラーにはならず処理が続行される。

---

### parseCLAUDEMdByPhase レスポンス

#### 型定義

```typescript
interface ParseResult {
  content?: string;
  sections: string[];
  errors: string[];
}
```

#### 成功レスポンス例

```json
{
  "content": "# 実装フェーズ\n\n実装時はTDDサイクルに従ってください。\n\n## AIへの厳命16\n\n設計したものは全て実装すること...",
  "sections": [
    "実装フェーズ",
    "AIへの厳命16",
    "AIへの厳命17"
  ],
  "errors": []
}
```

#### 失敗レスポンス例（セクション未発見）

```json
{
  "content": "エラー: 該当セクションが見つかりませんでした",
  "sections": [],
  "errors": [
    "該当セクションが見つかりませんでした: フェーズ=implementation セクション=実装フェーズ, AIへの厳命16"
  ]
}
```

#### 失敗レスポンス例（ファイル未発見）

```json
{
  "sections": [],
  "errors": [
    "CLAUDE.mdファイルが見つかりません: C:/project/CLAUDE.md 環境変数CLAUDE_MD_PATHを確認してください"
  ]
}
```

---

### workflow_create_subtask レスポンス

#### 型定義

```typescript
interface CreateSubtaskResult {
  success: boolean;
  taskId: string;
  taskName: string;
  phase: string;
  parentTaskId: string;
  message: string;
}
```

#### 成功レスポンス例

```json
{
  "success": true,
  "taskId": "20260216_143000",
  "taskName": "データベース設計",
  "phase": "research",
  "parentTaskId": "20260208_100521",
  "message": "サブタスクを作成しました: データベース設計（ID: 20260216_143000）"
}
```

#### 失敗レスポンス例（親タスク未発見）

```json
{
  "success": false,
  "taskId": "",
  "taskName": "",
  "phase": "",
  "parentTaskId": "",
  "message": "親タスクが見つかりません: 20260208_999999 タスクIDを確認してください"
}
```

---

### workflow_link_tasks レスポンス

#### 型定義

```typescript
interface LinkTasksResult {
  success: boolean;
  message: string;
}
```

#### 成功レスポンス例

```json
{
  "success": true,
  "message": "タスクをリンクしました: 親=20260208_100521 子=20260208_104500"
}
```

#### 失敗レスポンス例（循環参照）

```json
{
  "success": false,
  "message": "循環参照が検出されたためリンクできません。祖先チェーン: 20260208_104500 -> 20260208_095000 -> 20260208_100521"
}
```

#### 失敗レスポンス例（既存親エラー）

```json
{
  "success": false,
  "message": "子タスクは既に他の親タスクにリンクされています: 既存親=20260208_093000"
}
```

---

## 設定ファイル設計

本セクションでは環境変数による動作制御の設計を定義する。
検証厳格性、パス設定、文字数制限の3カテゴリの設定を環境変数で制御する。
設定はシステム環境変数、.envファイル、コード内デフォルト値の3段階で解決される。
開発初期は寛容モード、リリース前は厳格モードに切り替える運用を想定している。
環境変数名は英大文字とアンダースコアで構成し、既存の命名規則に準拠する。

### 環境変数一覧

本仕様で追加または使用する環境変数を以下に示す。

| 環境変数名 | 型 | デフォルト値 | 説明 | 影響範囲 |
|-----------|---|------------|------|---------|
| VALIDATE_DESIGN_STRICT | boolean | true | 禁止パターン検証を厳格に実行するか | workflow_pre_validate、artifact-validator |
| SEMANTIC_TRACE_STRICT | boolean | true | キーワードトレーサビリティを厳格に実行するか | validateKeywordTraceability |
| KEYWORD_COVERAGE_MIN | number | 0.8 | キーワードカバレッジの最低値（0.0～1.0） | validateKeywordTraceability |
| CLAUDE_MD_PATH | string | ./CLAUDE.md | CLAUDE.mdファイルの絶対パスまたは相対パス | parseCLAUDEMdByPhase |
| MAX_TASK_DEPTH | number | 5 | タスク親子関係の最大階層深度 | workflow_link_tasks |
| MAX_FEEDBACK_LENGTH | number | 10000 | フィードバック内容の最大文字数 | workflow_record_feedback |
| MAX_SUBTASK_NAME_LENGTH | number | 100 | サブタスク名の最大文字数 | workflow_create_subtask |

### 環境変数の設定方法

#### 方法1: .envファイル

プロジェクトルートに`.env`ファイルを作成する。

```env
# ワークフロー検証設定
VALIDATE_DESIGN_STRICT=true
SEMANTIC_TRACE_STRICT=false
KEYWORD_COVERAGE_MIN=0.75

# CLAUDE.mdパス設定
CLAUDE_MD_PATH=/absolute/path/to/CLAUDE.md

# タスク管理設定
MAX_TASK_DEPTH=5
MAX_FEEDBACK_LENGTH=10000
MAX_SUBTASK_NAME_LENGTH=100
```

#### 方法2: システム環境変数

Windows PowerShellの場合:

```powershell
$env:VALIDATE_DESIGN_STRICT = "false"
$env:SEMANTIC_TRACE_STRICT = "false"
$env:KEYWORD_COVERAGE_MIN = "0.7"
```

Unix系シェルの場合:

```bash
export VALIDATE_DESIGN_STRICT=false
export SEMANTIC_TRACE_STRICT=false
export KEYWORD_COVERAGE_MIN=0.7
```

---

### 設定の優先順位

以下の優先順位で設定値が決定される（上位が優先）。

1. システム環境変数
2. .envファイル
3. デフォルト値（コード内定数）

---

### 寛容モード運用ガイド

開発初期段階やプロトタイプフェーズでは、検証を寛容モードに設定することで柔軟な開発が可能になる。

```env
# 開発初期段階の推奨設定
VALIDATE_DESIGN_STRICT=false
SEMANTIC_TRACE_STRICT=false
KEYWORD_COVERAGE_MIN=0.6
```

製品リリース前や品質保証フェーズでは、厳格モードに戻すことを推奨する。

```env
# リリース前の推奨設定
VALIDATE_DESIGN_STRICT=true
SEMANTIC_TRACE_STRICT=true
KEYWORD_COVERAGE_MIN=0.8
```

---

## TypeScript型定義

各ツールおよび関数の完全な型定義を以下に示す。
実装時にはこれらの型定義をsrc/state/types.tsに追加する。
全ての結果型はexportされ、テストコードからも参照可能とする。
オプショナルフィールドは疑問符記法で定義し、省略時はundefinedとなる。
既存のTaskStateおよびPhaseGuideインターフェースへの拡張もここで定義する。

### PreValidateResult型

```typescript
/**
 * 成果物事前検証の結果
 */
export interface PreValidateResult {
  /** 検証合格フラグ */
  passed: boolean;

  /** エラーメッセージ配列 */
  errors: string[];

  /** 警告メッセージ配列（任意） */
  warnings?: string[];

  /** 実行された検証ルール名の配列 */
  checkedRules: string[];

  /** 人間可読な結果サマリー */
  message: string;
}
```

---

### RecordFeedbackResult型

```typescript
/**
 * フィードバック記録の結果
 */
export interface RecordFeedbackResult {
  /** 記録成功フラグ */
  success: boolean;

  /** 結果メッセージ */
  message: string;

  /** 更新後のuserIntent全文（任意） */
  updatedUserIntent?: string;
}
```

---

### KeywordTraceabilityResult型

```typescript
/**
 * キーワードトレーサビリティ検証の結果
 */
export interface KeywordTraceabilityResult {
  /** 検証合格フラグ */
  passed: boolean;

  /** カバレッジスコア（0.0～1.0） */
  coverage: number;

  /** 未参照キーワードの配列 */
  missingKeywords: string[];

  /** エラーメッセージ配列 */
  errors: string[];

  /** 警告メッセージ配列（任意） */
  warnings?: string[];
}
```

---

### ParseResult型

```typescript
/**
 * CLAUDE.mdパース結果
 */
export interface ParseResult {
  /** 抽出されたMarkdownテキスト（任意） */
  content?: string;

  /** 含まれるセクション見出し名の配列 */
  sections: string[];

  /** パースエラーメッセージの配列 */
  errors: string[];
}
```

---

### CreateSubtaskResult型

```typescript
/**
 * サブタスク作成の結果
 */
export interface CreateSubtaskResult {
  /** 作成成功フラグ */
  success: boolean;

  /** 新規作成されたサブタスクID */
  taskId: string;

  /** サブタスク名 */
  taskName: string;

  /** 初期フェーズ（常にresearch） */
  phase: string;

  /** 親タスクID */
  parentTaskId: string;

  /** 結果メッセージ */
  message: string;
}
```

---

### LinkTasksResult型

```typescript
/**
 * タスクリンクの結果
 */
export interface LinkTasksResult {
  /** リンク成功フラグ */
  success: boolean;

  /** 結果メッセージ */
  message: string;
}
```

---

### TaskState型拡張

既存のTaskStateインターフェースに以下のフィールドを追加する。

```typescript
export interface TaskState {
  // ... 既存フィールド省略 ...

  /**
   * 親タスクID（任意）
   * 子タスクの場合に設定される
   */
  parentTaskId?: string;

  /**
   * 子タスクIDの配列（任意）
   * 親タスクの場合に設定される
   */
  childTaskIds?: string[];

  /**
   * タスク種別（任意）
   * 'parent' | 'child' | 'standalone'
   * 未設定の場合はstandaloneとして扱う
   */
  taskType?: 'parent' | 'child' | 'standalone';
}
```

---

### PhaseGuide型拡張

既存のPhaseGuideインターフェースに以下のフィールドを追加する。

```typescript
export interface PhaseGuide {
  // ... 既存フィールド省略 ...

  /**
   * フェーズに必要なCLAUDE.mdセクションの抽出テキスト（任意）
   * parseCLAUDEMdByPhaseで設定される
   */
  content?: string;

  /**
   * 含まれるセクション見出し名の配列（任意）
   * parseCLAUDEMdByPhaseで設定される
   */
  claudeMdSections?: string[];
}
```

---

## Orchestratorによる使用パターン

Orchestratorが各ツールを組み合わせて使用する典型的なパターンを示す。
成果物検証パターンではsubagent完了後にworkflow_pre_validateで品質を確認する。
フィードバック記録パターンではユーザー追加要求をuserIntentに反映してからsubagentに伝達する。
タスク階層管理パターンでは親タスクから複数のサブタスクを作成して並行管理する。
各パターンのコード例を以下に示す。

### パターン1: 成果物検証 → フェーズ遷移

Orchestratorがsubagent完了後に成果物を検証してからworkflow_nextを呼び出すパターン。

```typescript
// 1. subagentタスク完了待機
await Task({ prompt: '...requirements...', subagent_type: 'general-purpose', model: 'sonnet' });

// 2. 成果物を事前検証
const validation = await mcp.callTool('workflow_pre_validate', {
  targetPhase: 'requirements',
  filePath: 'docs/workflows/タスク名/requirements.md'
});

// 3. 検証結果に応じて分岐
if (validation.passed) {
  // 検証成功 → フェーズ遷移
  await mcp.callTool('workflow_next', { taskId: currentTaskId });
} else {
  // 検証失敗 → subagentを再起動して修正
  await Task({
    prompt: `requirements.mdに以下の問題があります:\n${validation.errors.join('\n')}\n修正してください。`,
    subagent_type: 'general-purpose',
    model: 'sonnet'
  });
}
```

---

### パターン2: ユーザーフィードバック記録 → subagent起動

Orchestratorがユーザーからのフィードバックを記録してからsubagentに引き継ぐパターン。

```typescript
// 1. ユーザーからの追加要求をフィードバックに記録
await mcp.callTool('workflow_record_feedback', {
  feedback: 'エラーハンドリングを重視してください。リトライ処理も必要です。',
  appendMode: true
});

// 2. フィードバック反映後のTaskStateを読み込み
const status = await mcp.callTool('workflow_status', { taskId: currentTaskId });

// 3. userIntentを含めてsubagentに指示
await Task({
  prompt: `ユーザーの意図: ${status.userIntent}\n\n上記を踏まえて実装してください。`,
  subagent_type: 'general-purpose',
  model: 'sonnet'
});
```

---

### パターン3: 大規模タスクの階層管理

Orchestratorが親タスク配下に複数のサブタスクを作成して並行実行するパターン。

```typescript
// 1. 親タスク開始
const parent = await mcp.callTool('workflow_start', {
  taskName: '大規模ECサイト構築'
});

// 2. サブタスク作成
const sub1 = await mcp.callTool('workflow_create_subtask', {
  parentTaskId: parent.taskId,
  subtaskName: 'ユーザー認証機能',
  taskSize: 'medium'
});

const sub2 = await mcp.callTool('workflow_create_subtask', {
  parentTaskId: parent.taskId,
  subtaskName: '商品カタログ機能',
  taskSize: 'medium'
});

const sub3 = await mcp.callTool('workflow_create_subtask', {
  parentTaskId: parent.taskId,
  subtaskName: '決済処理機能',
  taskSize: 'large'
});

// 3. 各サブタスクを並行実行
// （実際にはタスクスイッチングまたは並列subagentで実現）
```

---

## 追加セクション: ログ出力設計

MCPサーバー内の各ツールは統一されたログ出力機構を使用する。
ログ出力はデバッグ、運用監視、障害調査の3つの目的で使用される。
全ログはタイムスタンプ、レベル、ツール名、メッセージの4要素で構成される。
環境変数LOG_LEVELにより出力レベルを制御し、本番環境ではINFO以上を推奨する。
開発時はDEBUGレベルでキャッシュヒット率やキーワード抽出数を確認可能にする。

### ログレベル定義

各ツールおよび関数は以下のログレベルで内部動作を記録する。

| ログレベル | 用途 | 出力先 | 例 |
|-----------|------|-------|-----|
| DEBUG | デバッグ情報 | console.debug | 「キーワード抽出結果: 42個」 |
| INFO | 通常情報 | console.log | 「成果物検証開始: requirements.md」 |
| WARN | 警告情報 | console.warn | 「キーワードカバレッジが低い: 0.65」 |
| ERROR | エラー情報 | console.error | 「ファイルが見つかりません: spec.md」 |

---

### ログフォーマット

全てのログは以下のフォーマットで出力される。

タイムスタンプ、ログレベル、ツール名、メッセージの4要素をスペース区切りで連結する形式を採用する。

例として、成果物検証時の一連のログは以下のような出力となる。

1行目: タイムスタンプ 2026-02-16T14:30:00.123Z にINFOレベルでworkflow_pre_validateが「成果物検証開始: requirements.md」を出力する。
2行目: タイムスタンプ 2026-02-16T14:30:00.456Z にDEBUGレベルでartifact-validatorが「セクション検証: 3/3個検出」を出力する。
3行目: タイムスタンプ 2026-02-16T14:30:00.789Z にINFOレベルでworkflow_pre_validateが「検証合格: requirements.md」を出力する。

---

### ログ出力の制御

環境変数`LOG_LEVEL`により出力されるログレベルを制御できる。

```env
# DEBUG以上を全て出力
LOG_LEVEL=DEBUG

# INFO以上を出力（デフォルト）
LOG_LEVEL=INFO

# WARN以上を出力
LOG_LEVEL=WARN

# ERRORのみ出力
LOG_LEVEL=ERROR
```

---

## 追加セクション: パフォーマンス考慮事項

パフォーマンスに影響を与える処理としてファイル読み込みと正規表現マッチングがある。
CLAUDE.mdパースとキーワード抽出の両方にメモリキャッシュを導入し高速化を図る。
キャッシュはMapオブジェクトをモジュールレベルで保持し、MCPサーバー再起動でクリアされる。
明示的なキャッシュ無効化APIは提供せず、プロセス再起動による暗黙的なクリアに依存する。
キャッシュキーにはファイルパスとフェーズ名の組み合わせを使用し一意性を保証する。

### parseCLAUDEMdByPhase キャッシュ戦略

初回パース後、結果をメモリキャッシュに保存することで2回目以降のパース処理を高速化する。

```typescript
// モジュールレベルのキャッシュ
const parseCache = new Map<string, ParseResult>();

function parseCLAUDEMdByPhase(claudeMdPath: string, phaseName: string): ParseResult {
  const cacheKey = `${claudeMdPath}:${phaseName}`;

  if (parseCache.has(cacheKey)) {
    console.debug(`parseCLAUDEMdByPhase キャッシュヒット: ${cacheKey}`);
    return parseCache.get(cacheKey);
  }

  // パース処理実行
  const result = performParsing(claudeMdPath, phaseName);

  // 結果をキャッシュに保存
  parseCache.set(cacheKey, result);

  return result;
}
```

---

### validateKeywordTraceability キャッシュ戦略

ソースドキュメントからのキーワード抽出結果をキャッシュすることで、同一ファイルへの再検証時のパフォーマンスを向上させる。

```typescript
// モジュールレベルのキーワードキャッシュ
const keywordCache = new Map<string, string[]>();

function extractKeywords(filePath: string, content: string): string[] {
  const cacheKey = `${filePath}:${content.length}`;

  if (keywordCache.has(cacheKey)) {
    console.debug(`extractKeywords キャッシュヒット: ${cacheKey}`);
    return keywordCache.get(cacheKey);
  }

  // キーワード抽出処理実行
  const keywords = performExtraction(content);

  // 結果をキャッシュに保存
  keywordCache.set(cacheKey, keywords);

  return keywords;
}
```

---

### キャッシュクリア方法

MCPサーバー再起動時に全てのキャッシュは自動的にクリアされる。手動でキャッシュをクリアする必要はない。

CLAUDE.mdファイルまたはソースドキュメントを変更した場合は、MCPサーバーを再起動することで最新の内容が反映される。

---

## 追加セクション: セキュリティ考慮事項

MCPツールのセキュリティは、パス検証、セッション検証、アクセス制御の3層で構成される。
ファイルパス検証ではプロジェクトルート外へのアクセスを防止しパストラバーサル攻撃を阻止する。
セッショントークン検証ではHMAC-SHA256署名の正当性を確認し状態改ざんを防止する。
ファイルアクセス権限はNode.jsのファイルシステムAPIの標準権限チェックに従う。
これらの防御層によりMCPツール経由での不正操作を多層的に防止する。

### ファイルパス検証

全てのツールは、filePathパラメータに対してパストラバーサル攻撃を防止する検証を実施する。

```typescript
function validateFilePath(filePath: string): boolean {
  // 相対パスの場合は絶対パスに変換
  const absolutePath = path.resolve(filePath);

  // プロジェクトルート外へのアクセスを防止
  const projectRoot = process.cwd();
  if (!absolutePath.startsWith(projectRoot)) {
    throw new Error(`不正なファイルパス: プロジェクト外へのアクセス: ${absolutePath}`);
  }

  // 親ディレクトリ参照（..）の連続を拒否
  if (filePath.includes('../') || filePath.includes('..\\')) {
    throw new Error(`不正なファイルパス: 親ディレクトリ参照が含まれています: ${filePath}`);
  }

  return true;
}
```

---

### セッショントークン検証

sessionTokenパラメータが指定された場合は、WorkflowStateManagerのvalidateSessionToken関数で正当性を検証する。

トークン検証に失敗した場合は、操作を拒否しエラーレスポンスを返却する。セッショントークンはHMAC-SHA256による署名であり、偽造は不可能である。

---

### ファイルアクセス権限

全てのファイル読み書き操作は、Node.jsのファイルシステムAPIの権限チェックに従う。MCPサーバープロセスの実行ユーザーがアクセス権限を持たないファイルには操作できない。

---

## 追加セクション: 後方互換性保証

全ての型拡張はオプショナルフィールドとして追加され、既存コードとの後方互換性を維持する。
TaskStateの3フィールドとPhaseGuideの2フィールドの合計5フィールドが新規追加される。
既存のloadStateおよびsaveState関数は新規フィールドの有無に関わらず正常動作する。
HMAC署名計算ではundefinedフィールドを署名対象から除外することで互換性を保つ。
既存の全ツールハンドラーは変更不要であり、新規フィールドを自然に無視する設計となっている。

### TaskState拡張の後方互換性

新規追加されるparentTaskId、childTaskIds、taskTypeフィールドは全てオプショナルである。既存タスクではこれらのフィールドがundefinedとなり、standaloneタスクとして扱われる。

既存のWorkflowStateManager関数は、新規フィールドの有無に関わらず正常に動作する。HMAC署名計算では、undefinedフィールドは署名対象から除外される。

---

### PhaseGuide拡張の後方互換性

新規追加されるcontentおよびclaudeMdSectionsフィールドは全てオプショナルである。CLAUDE.mdファイルが存在しない場合やパースに失敗した場合は、これらのフィールドがundefinedとなる。

既存のresolvePhaseGuide関数の呼び出し元は、contentフィールドの有無を確認してから使用する必要がある。

```typescript
const guide = resolvePhaseGuide(currentPhase);

if (guide.content) {
  // CLAUDE.mdから抽出されたコンテンツを使用
  sendToSubagent(guide.content);
} else {
  // 従来通りPhaseGuide情報のみ使用
  sendToSubagent(guide.description);
}
```

---

## 追加セクション: テスト戦略

テストは単体テストと統合テストの2層で構成し、全てのツールと関数をカバーする。
単体テストでは各ツールハンドラーの入力バリデーションとレスポンス構造を検証する。
統合テストではタスク親子関係の循環参照防止やtask-index.json同期の一貫性を検証する。
テストファイルはsrc/backend/tests/配下に配置し、vitest実行環境で実行する。
モックデータはsrc/backend/tests/fixtures/配下にカテゴリ別に配置する。

### ユニットテスト対象

以下の関数/ツールに対してユニットテストを実施する。

| テスト対象 | テストファイル | テスト項目数（推定） |
|-----------|---------------|-------------------|
| workflow_pre_validate | src/backend/tests/unit/pre-validate.test.ts | 15 |
| workflow_record_feedback | src/backend/tests/unit/record-feedback.test.ts | 12 |
| validateKeywordTraceability | src/backend/tests/unit/keyword-traceability.test.ts | 10 |
| parseCLAUDEMdByPhase | src/backend/tests/unit/claude-md-parser.test.ts | 8 |

---

### 統合テスト対象

以下のツール群に対して統合テストを実施する。

| テスト対象 | テストファイル | テスト項目数（推定） |
|-----------|---------------|-------------------|
| workflow_create_subtask + workflow_link_tasks | src/backend/tests/integration/subtask.test.ts | 10 |
| task-index.json同期 | src/backend/tests/integration/task-index-sync.test.ts | 8 |

---

### モックデータ設計

テスト用のモックファイルを以下のように配置する。

```
src/backend/tests/fixtures/
├── claude-md/
│   ├── valid-claude.md           # 正常なCLAUDE.md
│   ├── missing-section.md        # セクション不足
│   └── invalid-encoding.txt      # エンコーディング不正
├── artifacts/
│   ├── valid-requirements.md     # 正常なrequirements.md
│   ├── missing-sections.md       # セクション不足
│   ├── too-short.md              # 行数不足
│   ├── forbidden-patterns.md     # 禁止パターン含む
│   └── duplicate-lines.md        # 重複行含む
└── task-states/
    ├── parent-task.json          # 親タスク
    ├── child-task.json           # 子タスク
    └── standalone-task.json      # standaloneタスク
```

---

以上でUI設計書は完了する。次フェーズのtest_designでは、本設計書に基づいてテストケース一覧を作成する。
