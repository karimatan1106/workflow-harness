## サマリー

本ドキュメントはワークフロープラグインMCPサーバーのアーキテクチャ改善タスク（FR-1, FR-2, FR-3）に関するインターフェース設計書である。
本タスクはUIを持たないバックエンドTypeScriptの改善であり、「UI設計」フェーズとしてMCPツールのインターフェース設計を担う。

- 目的: 新規MCPツール `workflow_get_subphase_template` のAPIインターフェース、エラーメッセージ形式、レスポンス構造、および定数定義を確定する。
- 主要な決定事項:
  - 新規ツールの引数は `subPhaseName`（必須）と `taskId`（省略可能）の2種類とし、JSONスキーマで型定義する。
  - エラーレスポンスは `{ success: false, message: string }` の統一形式を採用する。
  - 成功レスポンスは `subagentTemplate` 文字列を中心とし、`requiredSections`・`minLines`・`outputFile` をオプションフィールドとして付加する。
  - `VALID_SUB_PHASE_NAMES` は11種類の文字列定数配列として定義し、実行時バリデーションの基準として使用する。
  - `SUB_PHASE_TO_PARENT_PHASE` は各サブフェーズ名から親の並列フェーズ名へのマッピング定数として定義する。
- 次フェーズで必要な情報: 各インターフェース定義の具体的なTypeScriptコードと、`server.ts` への登録手順。

---

## CLIインターフェース設計

本セクションでは新規MCPツール `workflow_get_subphase_template` の引数・オプション仕様を定義する。
Orchestratorは並列フェーズの各サブフェーズに対してこのツールを呼び出し、サブエージェント起動プロンプトを取得する。

### ツール名と呼び出し形式

ツール名は `workflow_get_subphase_template` とする。
Orchestratorは `mcp__workflow__workflow_get_subphase_template` として呼び出す。

### 引数定義

引数は以下の2つである。

第1引数 `subPhaseName`（必須）: 取得対象のサブフェーズ名を文字列で指定する。
- 型: `string`
- バリデーション: 後述の `VALID_SUB_PHASE_NAMES` のいずれかに一致すること
- 例示用の入力値として `planning` や `code_review` が代表的な使用例である

第2引数 `taskId`（省略可能）: タスクIDを文字列で指定する。
- 型: `string | undefined`
- 省略時: アクティブなタスクを自動検索して使用する
- 明示的に指定する場合は `task-20260223-001` のような形式のIDを渡す

### VALID_SUB_PHASE_NAMES 定数（11種類）

有効なサブフェーズ名の一覧を以下に示す。実行時バリデーションはこの定数配列との照合により行う。

```typescript
const VALID_SUB_PHASE_NAMES = [
  'threat_modeling',
  'planning',
  'state_machine',
  'flowchart',
  'ui_design',
  'build_check',
  'code_review',
  'manual_test',
  'security_scan',
  'performance_test',
  'e2e_test',
] as const;
```

各名称は `definitions.ts` の `PHASE_GUIDES` に登録されたサブフェーズ名と一致しており、
対応するテンプレートが必ず存在することが保証される設計となっている。

### SUB_PHASE_TO_PARENT_PHASE マッピング定数

各サブフェーズ名から親の並列フェーズ名へのマッピングを定数として定義する。
`resolvePhaseGuide()` 呼び出し時の第1引数として使用する。

```typescript
const SUB_PHASE_TO_PARENT_PHASE: Record<string, string> = {
  threat_modeling: 'parallel_analysis',
  planning: 'parallel_analysis',
  state_machine: 'parallel_design',
  flowchart: 'parallel_design',
  ui_design: 'parallel_design',
  build_check: 'parallel_quality',
  code_review: 'parallel_quality',
  manual_test: 'parallel_verification',
  security_scan: 'parallel_verification',
  performance_test: 'parallel_verification',
  e2e_test: 'parallel_verification',
};
```

このマッピングにより、サブフェーズ名だけを知るOrchestratorが適切な親フェーズのガイドを取得できる。

---

## エラーメッセージ設計

本セクションでは `workflow_get_subphase_template` ツールが返すエラーメッセージの形式を定義する。
全エラーは `{ success: false, message: string }` の統一形式で返す。

### エラーケース一覧

エラーケース1: 無効なサブフェーズ名が指定された場合
- エラーコード相当のカテゴリ: INVALID_SUB_PHASE_NAME
- メッセージ形式:

```
Invalid subPhaseName: "{指定された値}". Valid values are: threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test
```

- 設計意図: 有効な値の一覧を含めることで、Orchestratorがメッセージだけで正しい値を特定できるようにする。

エラーケース2: アクティブなタスクが見つからない場合（`taskId` 省略時）
- エラーコード相当のカテゴリ: NO_ACTIVE_TASK
- メッセージ形式:

```
No active task found. Please specify taskId explicitly or start a workflow task first.
```

- 設計意図: `taskId` を省略した場合の状況を明示し、回復手順を示す。

エラーケース3: 指定した `taskId` に対応するタスクが存在しない場合
- エラーコード相当のカテゴリ: TASK_NOT_FOUND
- メッセージ形式:

```
Task not found: "{taskId}". Please verify the task ID.
```

- 設計意図: 存在しないIDが渡された場合に明示的に通知する。

エラーケース4: サブフェーズガイドが取得できない場合（内部不整合時）
- エラーコード相当のカテゴリ: SUB_PHASE_GUIDE_NOT_FOUND
- メッセージ形式:

```
SubPhase guide not found for "{subPhaseName}" under parent phase "{parentPhaseName}". This may indicate a definitions.ts configuration issue.
```

- 設計意図: `PHASE_GUIDES` の設定不備を開発者が診断できるよう、親フェーズ名も含めて報告する。

### エラーレスポンスの型定義

全エラーケースで共通のレスポンス型を使用する。

```typescript
interface GetSubphaseTemplateErrorResult {
  success: false;
  message: string;
}
```

---

## APIレスポンス設計

本セクションでは `workflow_get_subphase_template` ツールの成功時・エラー時のレスポンス構造を定義する。

### 成功時レスポンス構造

成功時は `success: true` に加えて、テンプレート文字列と関連メタ情報を返す。

```typescript
interface GetSubphaseTemplateResult {
  success: true;
  subPhaseName: string;
  subagentTemplate: string;
  requiredSections?: string[];
  minLines?: number;
  outputFile?: string;
}
```

各フィールドの説明:

`success: true` は処理が正常完了したことを示すフラグである。エラーレスポンスとの判別に使用する。

`subPhaseName` はリクエストで指定されたサブフェーズ名をそのまま返すエコーフィールドである。Orchestratorが並列タスク処理時に受信結果を正しいサブフェーズと対応付けるために使用する。

`subagentTemplate` はプレースホルダーを展開済みのサブエージェントプロンプト文字列である。
`slimSubPhaseGuide()` は適用せず、フルテンプレートをそのまま返す点が `workflow_next` との重要な差異である。
展開対象プレースホルダーは `${taskName}`、`${taskId}`、`${docsDir}` の3種類である。

`requiredSections`（省略可能）はサブフェーズの成果物が含むべきMarkdown見出しの配列である。
`definitions.ts` の当該サブフェーズガイドに定義されている値をそのまま返す。

`minLines`（省略可能）はサブフェーズの成果物が持つべき最低行数である。
`PHASE_GUIDES` に定義されている場合に返し、定義がない場合はフィールドを省略する。

`outputFile`（省略可能）はサブフェーズの成果物ファイル名である。例として `spec.md`、`threat-model.md`、`code-review.md` などが返る。

### 成功時レスポンスの具体例（planningサブフェーズ）

```json
{
  "success": true,
  "subPhaseName": "planning",
  "subagentTemplate": "# planningフェーズ\n\n## タスク情報\n- タスク名: アーキテクチャ改善\n...",
  "requiredSections": ["## サマリー", "## 実装計画", "## 変更対象ファイル"],
  "minLines": 50,
  "outputFile": "spec.md"
}
```

### 成功時レスポンスの具体例（code_reviewサブフェーズ）

```json
{
  "success": true,
  "subPhaseName": "code_review",
  "subagentTemplate": "# code_reviewフェーズ\n\n## タスク情報\n...",
  "requiredSections": ["## サマリー", "## 設計-実装整合性"],
  "minLines": 30,
  "outputFile": "code-review.md"
}
```

### エラー時レスポンスの具体例

無効なサブフェーズ名が指定された場合のレスポンス例:

```json
{
  "success": false,
  "message": "Invalid subPhaseName: \"unknown_phase\". Valid values are: threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test"
}
```

### workflow_next との差異

`workflow_next` のレスポンスに含まれる `phaseGuide` は `slimSubPhaseGuide()` によって圧縮されており、
`subagentTemplate` フィールドは含まれない仕様となっている（MEMORY.md の記述通り）。
本ツールはこの制限を補完するために設計されており、フルテンプレートを直接提供することを目的とする。

---

## 設定ファイル設計

本セクションでは本タスクで新規作成・変更が必要な定数と設定の仕様を定義する。

### PHASE_ARTIFACT_REQUIREMENTS の修正仕様（FR-2対応）

変更対象ファイルは `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` である。
`PHASE_ARTIFACT_REQUIREMENTS` 定数内の以下3エントリの `requiredSections` を修正する。

`manual-test.md` エントリの変更仕様:
- 変更前の形式: `requiredSections: ['テストシナリオ', 'テスト結果']`
- 変更後の形式: `requiredSections: ['## テストシナリオ', '## テスト結果']`
- 変更理由: `definitions.ts` の `manual_test` サブフェーズガイドの `requiredSections` 形式（`## ` プレフィックスあり）に統一することで、バリデーション動作を一致させる。

`security-scan.md` エントリの変更仕様:
- 変更前の形式: `requiredSections: ['脆弱性スキャン結果', '検出された問題']`
- 変更後の形式: `requiredSections: ['## 脆弱性スキャン結果', '## 検出された問題']`
- 変更理由: `definitions.ts` の `security_scan` サブフェーズガイドと形式を統一する。

`threat-model.md` エントリの変更仕様:
- 変更前の形式: `requiredSections: ['## 脅威', '## リスク']`
- 変更後の形式: `requiredSections: ['## 脅威シナリオ', '## リスク評価']`
- 変更理由: `definitions.ts` の `threat_modeling` サブフェーズガイドの `requiredSections`（`'## 脅威シナリオ'`、`'## リスク評価'`）と見出し名を一致させる。`## サマリー` は全フェーズ共通のため重複チェックを避けて除外する。`## セキュリティ要件` は最低限の必須セットから外し、バリデーター上は2項目のみを強制する。

### minLines 管理の変更仕様（FR-3対応）

`next.ts` に追加するヘルパー関数 `getMinLinesFromPhaseGuide()` は、成果物ファイル名から `PHASE_GUIDES` の `minLines` を逆引きするマッピングを内部保持する。
マッピング定義（`FILE_TO_PHASE` 定数）の内容は以下の通りである。

```typescript
const FILE_TO_PHASE: Record<string, string> = {
  'research.md': 'research',
  'requirements.md': 'requirements',
  'spec.md': 'parallel_analysis',
  'threat-model.md': 'parallel_analysis',
  'test-design.md': 'test_design',
  'code-review.md': 'parallel_quality',
};
```

このマッピングに存在しないファイル名（`manual-test.md` など）は `undefined` を返し、
`checkPhaseArtifacts()` 内では `PHASE_ARTIFACT_REQUIREMENTS` の既存値をフォールバックとして使用する。

### server.ts への登録仕様（FR-1対応）

`ToolArguments` インターフェースに追加するエントリ:

```typescript
workflow_get_subphase_template: { subPhaseName: string; taskId?: string };
```

`validateToolArgs` の `requiredParams` マップに追加するエントリ:

```typescript
workflow_get_subphase_template: ['subPhaseName'],
```

スイッチ文への追加ケース:

```typescript
case 'workflow_get_subphase_template':
  result = await workflowGetSubphaseTemplate(args as ToolArguments['workflow_get_subphase_template']);
  break;
```

これらの登録によってOrchestratorは標準的なMCP呼び出しで新規ツールを利用できるようになる。
