# 設計-実装整合性の自動検証機能 仕様書

## 1. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     MCPサーバー                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  workflow_next() ─────┬───────────────────────────┐        │
│         │             │                           │        │
│         ▼             ▼                           ▼        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 承認チェック │  │ 並列完了    │  │ 設計整合性チェック   │ │
│  │ (既存)      │  │ チェック    │  │ (新規)              │ │
│  └─────────────┘  │ (既存)      │  └──────────┬──────────┘ │
│                   └─────────────┘             │            │
│                                               ▼            │
│                                    ┌─────────────────────┐ │
│                                    │ DesignValidator     │ │
│                                    │  - parseSpec()      │ │
│                                    │  - parseStateMachine│ │
│                                    │  - parseFlowchart() │ │
│                                    │  - validateAll()    │ │
│                                    └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 2. コンポーネント設計

### 2.1 DesignValidator

**ファイル**: `workflow-plugin/mcp-server/src/validation/design-validator.ts`

```typescript
/**
 * 設計-実装整合性検証クラス
 */
export class DesignValidator {
    private workflowDir: string;

    constructor(workflowDir: string);

    /**
     * 全設計書を検証
     * @returns 検証結果
     */
    validateAll(): ValidationResult;

    /**
     * spec.mdから設計項目を抽出
     */
    parseSpec(): SpecItems;

    /**
     * state-machine.mmdから状態遷移を抽出
     */
    parseStateMachine(): StateMachineItems;

    /**
     * flowchart.mmdからフロー項目を抽出
     */
    parseFlowchart(): FlowchartItems;

    /**
     * requirements.mdから要件項目を抽出
     */
    parseRequirements(): RequirementItems;

    /**
     * 抽出した設計項目と実装を照合
     */
    checkImplementation(items: DesignItems): ImplementationStatus;
}
```

### 2.2 型定義

**ファイル**: `workflow-plugin/mcp-server/src/validation/types.ts`

```typescript
/** 検証結果 */
export interface ValidationResult {
    passed: boolean;
    phase: string;
    timestamp: string;
    summary: {
        total: number;
        implemented: number;
        missing: number;
    };
    missingItems: MissingItem[];
    warnings: string[];
}

/** 未実装項目 */
export interface MissingItem {
    type: 'class' | 'method' | 'state' | 'process' | 'requirement';
    source: string;      // 設計書名
    name: string;        // 項目名
    expectedPath?: string; // 期待されるファイルパス
}

/** Spec.md から抽出した項目 */
export interface SpecItems {
    classes: ClassItem[];
    methods: MethodItem[];
    filePaths: string[];
}

/** State Machine から抽出した項目 */
export interface StateMachineItems {
    states: string[];
    transitions: Transition[];
    hasStart: boolean;
    hasEnd: boolean;
}

/** Flowchart から抽出した項目 */
export interface FlowchartItems {
    processes: ProcessItem[];
    decisions: DecisionItem[];
    subgraphs: string[];
}

/** Requirements.md から抽出した項目 */
export interface RequirementItems {
    functional: Requirement[];     // FR-*
    nonFunctional: Requirement[];  // NFR-*
    acceptance: AcceptanceCriteria[];  // AC-*
}
```

### 2.3 パーサーモジュール

**ファイル**: `workflow-plugin/mcp-server/src/validation/parsers/`

```
parsers/
├── index.ts           # エクスポート
├── spec-parser.ts     # spec.md パーサー
├── mermaid-parser.ts  # state-machine/flowchart パーサー
└── requirements-parser.ts  # requirements.md パーサー
```

## 3. 統合ポイント

### 3.1 next.ts への統合

**ファイル**: `workflow-plugin/mcp-server/src/tools/next.ts`

```typescript
// 既存の承認チェック・並列完了チェックの後に追加

// 設計整合性チェック（implementation開始前）
if (currentPhase === 'test_impl') {
    const validator = new DesignValidator(taskState.workflowDir);
    const result = validator.validateAll();

    if (!result.passed && !process.env.SKIP_DESIGN_VALIDATION) {
        const strict = process.env.VALIDATE_DESIGN_STRICT !== 'false';

        if (strict) {
            return {
                success: false,
                message: formatValidationError(result),
                details: result.missingItems
            };
        } else {
            // 警告モード: ログ出力のみ
            console.warn('設計未完了項目:', result.missingItems);
        }
    }
}
```

### 3.2 エラーメッセージフォーマット

```typescript
function formatValidationError(result: ValidationResult): string {
    const lines = [
        '============================================================',
        ' 設計-実装整合性チェック: 未完了項目があります',
        '============================================================',
        '',
        ` 完了率: ${result.summary.implemented}/${result.summary.total}`,
        '',
        ' 未実装項目:',
    ];

    for (const item of result.missingItems) {
        lines.push(`   - [${item.type}] ${item.name} (${item.source})`);
        if (item.expectedPath) {
            lines.push(`     期待パス: ${item.expectedPath}`);
        }
    }

    lines.push('');
    lines.push(' 対応方法:');
    lines.push('   1. 上記項目を実装してください');
    lines.push('   2. または、設計書を修正して /workflow reset で戻る');
    lines.push('');
    lines.push('============================================================');

    return lines.join('\n');
}
```

## 4. 設定

### 4.1 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `VALIDATE_DESIGN_STRICT` | `true` | 厳格モード（未完了でブロック） |
| `SKIP_DESIGN_VALIDATION` | `false` | 検証を完全にスキップ |
| `DESIGN_VALIDATION_TIMEOUT` | `3000` | タイムアウト（ミリ秒） |

### 4.2 検証対象フェーズ

| フェーズ遷移 | 検証内容 |
|-------------|---------|
| test_impl → implementation | 設計完了チェック（全項目が定義済みか） |
| refactoring → parallel_quality | 実装完了チェック（設計項目が実装済みか） |

## 5. 実装ファイル一覧

| ファイルパス | 説明 |
|-------------|------|
| `src/validation/design-validator.ts` | メインバリデーター |
| `src/validation/types.ts` | 型定義 |
| `src/validation/parsers/index.ts` | パーサーエクスポート |
| `src/validation/parsers/spec-parser.ts` | spec.mdパーサー |
| `src/validation/parsers/mermaid-parser.ts` | Mermaidパーサー |
| `src/validation/parsers/requirements-parser.ts` | requirements.mdパーサー |
| `src/tools/next.ts` | 統合（既存ファイル修正） |
| `src/utils/format-validation-error.ts` | エラーフォーマッター |
