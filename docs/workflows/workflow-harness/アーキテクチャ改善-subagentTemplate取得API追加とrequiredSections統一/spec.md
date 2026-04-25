## サマリー

本仕様書はワークフロープラグインの3つのアーキテクチャ改善タスク（FR-1: 新規MCPツール追加、FR-2: requiredSections形式統一、FR-3: minLines単一ソース化）の詳細実装仕様を定義する。

- 目的: Orchestratorが並列サブフェーズの `subagentTemplate` を取得できない問題、`requiredSections` の形式不一致問題、`minLines` の二重定義問題を解消し、ワークフロー品質の信頼性を向上させる。
- 主要な決定事項:
  - FR-1: `workflow_get_subphase_template` という新規MCPツールを `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts` に追加し、`server.ts` と `tools/index.ts` に登録する。
  - FR-2: `artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` において `manual-test.md` と `security-scan.md` の `requiredSections` に `## ` プレフィックスを付与し、`definitions.ts` の形式に合わせる。
  - FR-3: `artifact-validator.ts` の `validateArtifactQualityCore()` 内の行数チェックロジックを変更し、`PHASE_GUIDES` の `minLines` を優先参照する形に変更する。ただし循環参照回避のため `PHASE_GUIDES` の直接 import ではなく、コールバック注入パターンを採用する。
- 次フェーズで必要な情報: 変更対象ファイルのパス、各変更の具体的コード断片、影響を受けるテストファイルのパス。

---

## 概要

本タスクはワークフロープラグインのMCPサーバーに対して3種類のアーキテクチャ上の改善を適用するものである。

現状の問題点として、Orchestratorが並列フェーズの各サブフェーズ（`planning`, `threat_modeling` 等）に対して `subagentTemplate` を取得する手段がなく、
`workflow_next` のレスポンスにはスリム化されたガイドしか含まれないため、Orchestratorが適切なプロンプトを構築できない状況が発生している。

また、`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` と `definitions.ts` の `requiredSections` 定義では、前者が `'テストシナリオ'` という形式を使用し、
後者が `'## テストシナリオ'` という形式を使用しているため、バリデーション結果が期待通りにならない不整合が生じている。

さらに `minLines` の値が `PHASE_GUIDES`（`definitions.ts`）と `PHASE_ARTIFACT_REQUIREMENTS`（`artifact-validator.ts`）の両方に分散して定義されており、
どちらが実際に適用されるかが不明瞭な状態である。本改善では `PHASE_GUIDES` の値を単一の正とし、`next.ts` 経由でバリデーターに渡す設計とする。

---

## 実装計画

実装は以下の順序で実施する。各ステップは前のステップの成果物に依存するため、順番を遵守すること。

ステップ1: FR-2（requiredSections形式統一）から着手する。この変更は `artifact-validator.ts` のみを対象とし、他のファイルへの影響が最小限であるため最初に実施する。
修正対象は `manual-test.md`、`security-scan.md`、`threat-model.md` の3エントリの `requiredSections` 配列である。

ステップ2: FR-3（minLines単一ソース化）を実施する。`next.ts` に `getMinLinesFromPhaseGuide()` ヘルパー関数を追加し、
`checkPhaseArtifacts()` 内のバリデーション呼び出しを変更して `PHASE_GUIDES` の値を優先参照する形に切り替える。
`artifact-validator.ts` 自体は変更しない（循環参照回避のため）。

ステップ3: FR-1（新規MCPツール追加）を実施する。`get-subphase-template.ts` を新規作成し、
`tools/index.ts` および `server.ts` へ登録する。このステップが最も変更箇所が多いため、最後に実施して他の変更との干渉を防ぐ。

ステップ4: 各FRに対応するテストを追加・修正する。FR-2の変更により既存テストが影響を受ける可能性があるため、
既存テストファイルの期待値を更新してから新規テストケースを追加する。

---

## 変更対象ファイル

本タスクで変更が必要なファイルは以下の5件である。

新規作成ファイル:
- `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts`: FR-1の中核実装。`workflowGetSubphaseTemplate()` 関数と `getSubphaseTemplateToolDefinition` 定数を含む。

既存ファイルへの変更:
- `workflow-plugin/mcp-server/src/tools/index.ts`: `get-subphase-template.js` からのエクスポート文を1行追加する。
- `workflow-plugin/mcp-server/src/server.ts`: import文、`TOOL_DEFINITIONS` 配列、`ToolArguments` インターフェース、`validateToolArgs` の `requiredParams`、ルーティングロジックの合計5箇所を変更する。
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`: `PHASE_ARTIFACT_REQUIREMENTS` の `manual-test.md`、`security-scan.md`、`threat-model.md` エントリの `requiredSections` を修正する（FR-2対応）。
- `workflow-plugin/mcp-server/src/tools/next.ts`: `getMinLinesFromPhaseGuide()` ヘルパー関数を追加し、`checkPhaseArtifacts()` 内のバリデーション呼び出しを変更する（FR-3対応）。

---

## 実装仕様

### FR-1: workflow_get_subphase_template ツール追加

#### 1-A: 新規ファイル作成

作成するファイルのパスは `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts` である。
このファイルは既存の `next.ts` や `status.ts` と同じ構造パターンに準拠して実装する。

ファイルの先頭には以下の `@spec` コメントを付与すること。

```typescript
/**
 * workflow_get_subphase_template ツール
 * サブフェーズ名を指定して subagentTemplate を個別取得するMCPツール。
 * @spec docs/spec/features/workflow-mcp-server.md
 */
```

#### 1-B: 引数の型定義

ツールが受け取る引数の型定義は以下の通りである。

```typescript
interface GetSubphaseTemplateArgs {
  subPhaseName: string;  // 必須
  taskId?: string;       // 省略可能
}
```

有効な `subPhaseName` の値は `threat_modeling`, `planning`, `state_machine`, `flowchart`, `ui_design`, `build_check`, `code_review`, `manual_test`, `security_scan`, `performance_test`, `e2e_test` の11種類である。
バリデーションは `VALID_SUB_PHASE_NAMES` という定数配列を定義して実行時チェックに使用する。

#### 1-C: 返値の型定義

ツールが返すオブジェクトの型定義は以下の通りである。

```typescript
interface GetSubphaseTemplateResult {
  success: boolean;
  subPhaseName: string;
  subagentTemplate: string;
  requiredSections?: string[];
  minLines?: number;
  outputFile?: string;
}
```

エラー時は `{ success: false, message: string }` 形式で返す。

#### 1-D: 内部処理の設計

`workflowGetSubphaseTemplate()` 関数内では以下の手順で処理を実施する。

1. `subPhaseName` が `VALID_SUB_PHASE_NAMES` に含まれることを確認する。含まれない場合は `success: false` を返す。
2. `taskId` が省略された場合は `getTaskByIdOrError(undefined)` を使用してアクティブなタスクを自動検索する。タスクが見つからない場合は `success: false` を返す。
3. `resolvePhaseGuide()` を呼び出してフェーズガイドを取得する。`resolvePhaseGuide` は並列フェーズの親ガイドを返すため、`phaseGuide.subPhases[subPhaseName]` でサブフェーズのガイドを取り出す。
4. サブフェーズガイドが存在しない場合は `success: false` を返す。
5. `subagentTemplate` のプレースホルダーを展開する。具体的には `${taskName}` と `${taskId}` を `taskState.taskName` と `taskState.taskId` で置換する。また `${docsDir}` を `taskState.docsDir` で置換する。
6. `slimSubPhaseGuide()` は適用しない。フルテンプレートをそのまま返す。

`resolvePhaseGuide()` を呼び出す際に第一引数として渡すフェーズ名は、サブフェーズが属する親フェーズ名（例: `planning` であれば `parallel_analysis`）を使用する。この親フェーズ名を解決するために `SUB_PHASE_TO_PARENT_PHASE` というマッピング定数をファイル内に定義する。

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

#### 1-E: ツール定義（MCPスキーマ）

`getSubphaseTemplateToolDefinition` という名前でMCPスキーマを export する。

```typescript
export const getSubphaseTemplateToolDefinition = {
  name: 'workflow_get_subphase_template',
  description: '指定されたサブフェーズの subagentTemplate を取得します。並列フェーズのサブフェーズテンプレートを Orchestrator が利用する場合に使用します。',
  inputSchema: {
    type: 'object',
    properties: {
      subPhaseName: {
        type: 'string',
        description: 'サブフェーズ名（threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test のいずれか）',
      },
      taskId: {
        type: 'string',
        description: 'タスクID（省略時はアクティブなタスクを自動検索）',
      },
    },
    required: ['subPhaseName'],
  },
};
```

#### 1-F: server.ts および tools/index.ts への登録

`tools/index.ts` に以下の export 文を追加する。

```typescript
/** サブフェーズテンプレート取得ツール */
export { workflowGetSubphaseTemplate, getSubphaseTemplateToolDefinition } from './get-subphase-template.js';
```

`server.ts` の import 文に `workflowGetSubphaseTemplate` と `getSubphaseTemplateToolDefinition` を追加する。
`TOOL_DEFINITIONS` 配列に `getSubphaseTemplateToolDefinition` を追加する。
`ToolArguments` インターフェースに `workflow_get_subphase_template` のエントリを追加する。
`validateToolArgs` の `requiredParams` マップに `workflow_get_subphase_template: ['subPhaseName']` を追加する。
`CallToolRequest` ハンドラーの switch 文（またはルーティングロジック）に `workflow_get_subphase_template` のケースを追加する。

---

### FR-2: requiredSections 形式統一

#### 2-A: 変更対象の特定

変更対象ファイルは `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` のみである。
`PHASE_ARTIFACT_REQUIREMENTS` 定数内の以下のエントリを変更する。

変更前の `manual-test.md` エントリの `requiredSections` 値は以下の通りである。

```typescript
requiredSections: ['テストシナリオ', 'テスト結果'],
```

変更後の値は以下の通りである。

```typescript
requiredSections: ['## テストシナリオ', '## テスト結果'],
```

変更前の `security-scan.md` エントリの `requiredSections` 値は以下の通りである。

```typescript
requiredSections: ['脆弱性スキャン結果', '検出された問題'],
```

変更後の値は以下の通りである。

```typescript
requiredSections: ['## 脆弱性スキャン結果', '## 検出された問題'],
```

#### 2-B: threat-model.md の requiredSections 修正

現在の `threat-model.md` エントリの `requiredSections` は `['## 脅威', '## リスク']` であり、`definitions.ts` の `threat_modeling` サブフェーズの `requiredSections`（`['## サマリー', '## 脅威シナリオ', '## リスク評価', '## セキュリティ要件']`）と名称が異なる。

この不一致を解消するために `artifact-validator.ts` の `threat-model.md` エントリを以下のように変更する。

```typescript
'threat-model.md': {
  minLines: 20,
  minLinesForTransition: 5,
  requiredSections: ['## 脅威シナリオ', '## リスク評価'],
},
```

`## サマリー` は全フェーズ共通で要求されるが `PHASE_ARTIFACT_REQUIREMENTS` には含めない（`validateRequiredSections()` は `definitions.ts` の `requiredSections` を参照するため重複チェックになる）。`## セキュリティ要件` については `definitions.ts` 側の requiredSections にあるが、バリデーターの `PHASE_ARTIFACT_REQUIREMENTS` では `## 脅威シナリオ` と `## リスク評価` の2項目を必須とする（最低限の検証セット）。

#### 2-C: validateRequiredSections() のロジックへの影響分析

`validateRequiredSections()` は `content.includes(section)` によるマッチングを使用している。`## ` プレフィックスを付与した場合でも `includes()` による部分一致は機能するため、既存の成果物との後方互換性は保たれる。
成果物に `## テストシナリオ` という見出しが含まれていれば、`'テストシナリオ'` による検索も `'## テストシナリオ'` による検索も両方ヒットする。変更後は `'## テストシナリオ'` による検索のみになるが、サブエージェントはこの見出し形式で成果物を作成するよう指示されているため、実動作に影響はない。

---

### FR-3: minLines 単一ソース化

#### 3-A: 設計方針（循環参照回避）

`definitions.ts` は `artifact-validator.ts` から `exportGlobalRules()` を import している。もし `artifact-validator.ts` が `definitions.ts` の `PHASE_GUIDES` を import すると循環参照が発生する。

循環参照を回避するために `validateArtifactQuality()` の公開APIシグネチャを変更し、呼び出し元（`next.ts` の `checkPhaseArtifacts()`）が `PHASE_GUIDES` から `minLines` を取得して `ArtifactRequirement` オブジェクトを上書きする形式を採用する。

```typescript
// next.ts 側の修正例（checkPhaseArtifacts 内）
const phaseGuideMinLines = getMinLinesFromPhaseGuide(artifactFile);  // 追加ヘルパー
const requirements = {
  ...baseRequirements,
  minLines: phaseGuideMinLines ?? baseRequirements.minLines,
};
```

この方式では `artifact-validator.ts` 自体への変更は不要であり、`next.ts` が `definitions.ts` の `PHASE_GUIDES` を直接参照する形となる。

#### 3-B: next.ts の変更内容

`next.ts` に `getMinLinesFromPhaseGuide()` というヘルパー関数を追加する。

```typescript
/**
 * 成果物ファイル名から PHASE_GUIDES の minLines を取得する
 * @param artifactFileName 成果物ファイル名（例: 'research.md', 'spec.md'）
 * @returns PHASE_GUIDES に定義された minLines。対応するフェーズが存在しない場合は undefined を返す
 */
function getMinLinesFromPhaseGuide(artifactFileName: string): number | undefined {
  // ファイル名からフェーズ名を逆引きするマッピング
  const FILE_TO_PHASE: Record<string, string> = {
    'research.md': 'research',
    'requirements.md': 'requirements',
    'spec.md': 'parallel_analysis',  // spec.md は planning サブフェーズの成果物
    'threat-model.md': 'parallel_analysis',
    'test-design.md': 'test_design',
    'code-review.md': 'parallel_quality',
  };
  const phaseName = FILE_TO_PHASE[artifactFileName];
  if (!phaseName) return undefined;
  const guide = PHASE_GUIDES[phaseName];
  if (!guide) return undefined;
  // サブフェーズの場合は subPhases から取得
  if (artifactFileName === 'spec.md') {
    return (guide.subPhases?.['planning'] as unknown as PhaseGuide | undefined)?.minLines;
  }
  if (artifactFileName === 'threat-model.md') {
    return (guide.subPhases?.['threat_modeling'] as unknown as PhaseGuide | undefined)?.minLines;
  }
  if (artifactFileName === 'code-review.md') {
    return (guide.subPhases?.['code_review'] as unknown as PhaseGuide | undefined)?.minLines;
  }
  return guide.minLines;
}
```

`checkPhaseArtifacts()` 内のフル検証パスを以下のように変更する。

```typescript
// 変更前
const validationResult = validateArtifactQuality(filePath, baseRequirements);

// 変更後
const phaseGuideMinLines = getMinLinesFromPhaseGuide(artifactFile);
const effectiveRequirements = phaseGuideMinLines !== undefined
  ? { ...baseRequirements, minLines: phaseGuideMinLines }
  : baseRequirements;
const validationResult = validateArtifactQuality(filePath, effectiveRequirements);
```

#### 3-C: minLines 値の確定一覧

`PHASE_GUIDES` の定義に基づく確定値は以下の通りである。

| ファイル | PHASE_GUIDES の値 | PHASE_ARTIFACT_REQUIREMENTS の現在値 | 統一後の有効値 |
|---------|-------------------|--------------------------------------|--------------|
| research.md | 50 | 20 | 50 |
| requirements.md | 50 | 30 | 50 |
| spec.md (planning) | 50 | 50 | 50 |
| threat-model.md | 50 | 20 | 50 |
| test-design.md | 50 | 30 | 50 |
| code-review.md | 30 | 30 | 30 |

`PHASE_GUIDES` に `minLines` が定義されていないファイル（`manual-test.md`, `security-scan.md`, `performance-test.md`, `e2e-test.md` など）は `PHASE_ARTIFACT_REQUIREMENTS` の既存値をそのまま使用する。

---

### 変更が必要なファイルの完全リスト

変更対象ファイルは以下の4ファイルである。

1. `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts`（新規作成）
   - `workflowGetSubphaseTemplate()` 関数と `getSubphaseTemplateToolDefinition` 定数を実装する。

2. `workflow-plugin/mcp-server/src/tools/index.ts`（既存ファイル変更）
   - `get-subphase-template.js` からの export 文を追加する。

3. `workflow-plugin/mcp-server/src/server.ts`（既存ファイル変更）
   - import 文への追加、`TOOL_DEFINITIONS` 配列への追加、`ToolArguments` インターフェースへの追加、`validateToolArgs` の `requiredParams` への追加、ルーティングロジックへのケース追加の5箇所を変更する。

4. `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（既存ファイル変更）
   - `PHASE_ARTIFACT_REQUIREMENTS` の `manual-test.md`・`security-scan.md`・`threat-model.md` エントリの `requiredSections` を修正する。

5. `workflow-plugin/mcp-server/src/tools/next.ts`（既存ファイル変更）
   - `getMinLinesFromPhaseGuide()` ヘルパー関数を追加し、`checkPhaseArtifacts()` 内のフル検証パスで PHASE_GUIDES の minLines を優先参照するよう変更する。

---

### 既存テストへの影響

`artifact-validator.ts` の `requiredSections` 変更（FR-2）は、既存のテストが `'テストシナリオ'` という文字列でアサーションを行っている場合に失敗する可能性がある。変更後は `'## テストシナリオ'` という文字列に変更されるため、テストファイルでの期待値も同様に変更する必要がある。

`next.ts` の `getMinLinesFromPhaseGuide()` 追加（FR-3）は、`checkPhaseArtifacts()` の挙動を変更するため、既存の統合テストでファイル行数に関するモックや期待値が変更になる可能性がある。

---

## テスト仕様

### FR-1 のテスト仕様

テストファイルの配置先は `workflow-plugin/mcp-server/src/tools/get-subphase-template.test.ts` である。

テストケース1: 正常系 - 有効なサブフェーズ名を指定した場合
- 入力: `subPhaseName: 'planning'`、アクティブなタスクが存在する状態
- 期待値: `success: true`、`subagentTemplate` が50文字以上の文字列、`subPhaseName: 'planning'`
- 検証方法: `workflowGetSubphaseTemplate({ subPhaseName: 'planning' })` を呼び出し、返値の各フィールドをアサーションする

テストケース2: 正常系 - すべてのサブフェーズ名について subagentTemplate が返ること
- 入力: 11種類のサブフェーズ名をループで指定
- 期待値: いずれも `success: true` かつ `subagentTemplate` が非空文字列
- 検証方法: `VALID_SUB_PHASE_NAMES` 配列をループし、各名前で呼び出してアサーションする

テストケース3: 異常系 - 無効なサブフェーズ名を指定した場合
- 入力: `subPhaseName: 'invalid_phase'`
- 期待値: `success: false`、エラーメッセージが含まれる
- 検証方法: `workflowGetSubphaseTemplate({ subPhaseName: 'invalid_phase' })` を呼び出し、`success === false` をアサーションする

テストケース4: 正常系 - slimSubPhaseGuide が適用されないことの確認
- 入力: `subPhaseName: 'code_review'`
- 期待値: `subagentTemplate` フィールドが存在し、空でないこと（`workflow_next` の返値ではこのフィールドが削除される）
- 検証方法: 返値の `subagentTemplate` フィールドの存在と非空をアサーションする

### FR-2 のテスト仕様

テスト対象ファイルは `workflow-plugin/mcp-server/src/validation/artifact-validator.test.ts`（既存）または同ディレクトリの新規テストファイルである。

テストケース1: manual-test.md のバリデーション - `## テストシナリオ` を含む場合は通過すること
- 入力: `## テストシナリオ` と `## テスト結果` を含むコンテンツ
- 期待値: `validateArtifactQuality()` の返値が `passed: true`
- 検証方法: `validateArtifactQuality(filePath, PHASE_ARTIFACT_REQUIREMENTS['manual-test.md'])` を呼び出す

テストケース2: manual-test.md のバリデーション - `## ` なしで `テストシナリオ` を含む場合の挙動確認
- 入力: `テストシナリオ` という文字列を含むが `## テストシナリオ` 見出しのないコンテンツ
- 期待値: バリデーション失敗（必須セクション欠如のエラーが含まれる）
- 補足: 変更前は通過していたが、変更後は `## ` プレフィックスが必要になるため

テストケース3: security-scan.md のバリデーション - 同様のパターンで `## 脆弱性スキャン結果` と `## 検出された問題` を検証する

### FR-3 のテスト仕様

テスト対象は `workflow-plugin/mcp-server/src/tools/next.ts` の `checkPhaseArtifacts()` 関数の挙動である。

テストケース1: research.md の行数チェックに PHASE_GUIDES の minLines（50行）が適用されること
- 前提: モックファイルに40行のコンテンツを用意する（PHASE_ARTIFACT_REQUIREMENTS の 20行は超えるが PHASE_GUIDES の 50行は下回る）
- 期待値: バリデーション失敗（行数不足のエラーが含まれる）
- 検証方法: `checkPhaseArtifacts('research', mockDocsDir)` の返値にエラーが含まれることをアサーションする

テストケース2: PHASE_GUIDES に定義のないファイル（manual-test.md 等）は PHASE_ARTIFACT_REQUIREMENTS の minLines が継続使用されること
- 前提: モックファイルに15行のコンテンツを用意する（PHASE_ARTIFACT_REQUIREMENTS の 20行を下回る）
- 期待値: バリデーション失敗（行数不足）
- 補足: PHASE_GUIDES に minLines が設定されていない場合、PHASE_ARTIFACT_REQUIREMENTS のフォールバックが正しく機能することを確認する

テストケース3: getMinLinesFromPhaseGuide() のユニットテスト
- 各ファイル名を入力として呼び出し、期待される minLines 値が返ることを確認する
- `research.md` → 50、`requirements.md` → 50、存在しないファイル名 → undefined

