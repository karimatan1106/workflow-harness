# 実装仕様書: ワークフロー1000万行対応強化

**文書作成日**: 2026-02-07
**フェーズ**: planning
**バージョン**: 1.0

---

## 1. 概要

### 1.1 目的

本仕様書は、ワークフローMCPサーバーにおける4つの致命的なセキュリティ/品質検証の問題を解決するための詳細な実装仕様を定義する。

### 1.2 スコープ

**変更対象:**
- `workflow-plugin/mcp-server/src/` 配下のTypeScriptソースコード（ESM）
- `workflow-plugin/hooks/` 配下のJavaScriptフックスクリプト（CommonJS）

**対象外:**
- フロントエンド、バックエンドAPI、データベース、外部システム連携

---

## 2. アーキテクチャ設計

### 2.1 モジュール構成図

```
workflow-plugin/
├── mcp-server/src/
│   ├── tools/
│   │   ├── record-test-result.ts    # REQ-1: テスト結果偽造防止
│   │   └── set-scope.ts              # REQ-3: スコープ検証強化
│   ├── validation/
│   │   ├── design-validator.ts       # REQ-2: 設計検証強化
│   │   ├── ast-analyzer.ts           # 新規: AST解析
│   │   └── dependency-analyzer.ts    # 新規: 依存関係解析
│   └── audit/
│       └── logger.ts                  # 新規: 監査ログ記録
└── hooks/
    ├── phase-edit-guard.js           # REQ-4: 監査ログ統合
    ├── enforce-workflow.js           # REQ-4: 監査ログ統合
    └── block-dangerous-commands.js   # REQ-4: 監査ログ統合
```

### 2.2 データフロー

#### REQ-1: テスト結果記録の流れ

```
AI → workflowRecordTestResult(exitCode, output)
      ↓
    [整合性検証]
      ├─ exitCode=0 + FAILキーワード → ブロック
      ├─ exitCode≠0 + PASSのみ → ブロック
      ├─ テストフレームワーク構造なし → 警告
      └─ テスト件数を自動抽出
      ↓
    TaskState.testResults[] に記録
```

#### REQ-2: 設計検証の流れ

```
implementationフェーズ開始時
      ↓
DesignValidator.validateAll()
      ↓
    [spec.md 解析]
      ├─ parseSpec() → クラス・メソッド抽出
      └─ ASTAnalyzer.analyzeFile() → 実装内容検証
      ↓
    [state-machine.mmd 解析]
      ├─ parseStateMachine() → 状態・遷移抽出
      └─ ASTAnalyzer.validateDiagram() → 構造検証
      ↓
    [flowchart.mmd 解析]
      └─ parseFlowchart() → ノード・エッジ抽出
      ↓
    [実装コード検証]
      └─ ASTAnalyzer で空クラス・空メソッド検出
      ↓
    ValidationResult (passed/failed)
```

#### REQ-3: スコープ設定の流れ

```
AI → workflowSetScope(taskId, files, dirs)
      ↓
    [存在チェック]
      ├─ fs.existsSync(file) → 存在しないファイルをブロック
      └─ fs.existsSync(dir) → 存在しないディレクトリをブロック
      ↓
    [依存関係解析]
      ├─ DependencyAnalyzer.analyzeImports() → import文を解析
      ├─ スコープ外依存を検出 → 警告メッセージ
      └─ 推奨スコープを提案
      ↓
    TaskState.scope に記録
```

#### REQ-4: 監査ログの流れ

```
環境変数検出（SKIP_PHASE_GUARD=true 等）
      ↓
AuditLogger.log({
  timestamp, event: "bypass_enabled",
  variable, taskId, phase
})
      ↓
.claude/state/audit-log.jsonl に追記（JSONL形式）
      ↓
    [ローテーション]
      └─ 10MB超でローテーション → .1, .2, ... .5
```

---

## 3. 詳細設計

### 3.1 REQ-1: テスト結果偽造防止

#### 3.1.1 変更対象ファイル

**ファイル**: `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/record-test-result.ts`

#### 3.1.2 現状の問題点

```typescript
// 現状の実装（問題がある）
if (!hasTestKeyword) {
  console.warn('[record-test-result] テスト関連キーワードが見つかりません。');
  // 警告のみで通過してしまう
}

if (exitCode === 0) {
  const hasFailureKeyword = FAILURE_KEYWORDS.some(kw => output.includes(kw));
  if (hasFailureKeyword) {
    console.warn('[record-test-result] exitCode=0ですが、出力に失敗を示すキーワードが含まれています。');
    // 警告のみで通過してしまう
  }
}
```

#### 3.1.3 改善仕様

##### 3.1.3.1 定数定義の追加

```typescript
/** exitCode=0でブロックすべき失敗キーワード（大文字小文字不問） */
const BLOCKING_FAILURE_KEYWORDS = [
  'FAIL',
  'FAILED',
  'ERROR',
  'ERRORS',
  '×',
  '✗',
  'failing',
  'failures',
  'errored',
] as const;

/** exitCode≠0でブロックすべき成功キーワード（大文字小文字不問） */
const BLOCKING_SUCCESS_KEYWORDS = [
  'all tests passed',
  'tests passed',
  'all passed',
  '100% passed',
] as const;

/** テストフレームワーク構造を示すパターン（正規表現） */
const TEST_FRAMEWORK_PATTERNS = [
  /(\d+)\s+tests?\s+passed/i,                     // "5 tests passed", "1 test passed"
  /Tests:\s*(\d+)\s+passed/i,                      // "Tests: 5 passed, 5 total" (Jest)
  /PASS\s+.*\.(test|spec)\.(ts|js|tsx|jsx)/i,     // "PASS  ./user.test.ts"
  /✓.*test/i,                                      // "✓ should validate input"
  /Test Suites:\s*(\d+)\s+passed/i,                // "Test Suites: 1 passed, 1 total" (Jest)
] as const;

/** エラーパターン（警告用） */
const ERROR_PATTERNS = [
  /at\s+.*\(.*\.(ts|js|tsx|jsx):\d+:\d+\)/,       // スタックトレース
  /Expected.*but got/i,                            // Assertion error
  /(Uncaught|Unhandled)/i,                         // Uncaught exception
] as const;
```

##### 3.1.3.2 整合性検証関数の追加

```typescript
/**
 * テスト出力とexitCodeの整合性を検証（Fail Closed）
 *
 * @param exitCode - テスト終了コード
 * @param output - テスト実行の出力
 * @returns 検証結果 { valid: boolean, error?: string, warning?: string }
 */
function validateTestOutputConsistency(
  exitCode: number,
  output: string
): { valid: boolean; error?: string; warning?: string } {

  // AC-1.1: exitCode=0 + FAILキーワード → ブロック
  if (exitCode === 0) {
    const hasFailure = BLOCKING_FAILURE_KEYWORDS.some(kw =>
      output.toLowerCase().includes(kw.toLowerCase())
    );
    if (hasFailure) {
      return {
        valid: false,
        error: 'テスト出力に失敗を示すキーワードが含まれていますが、exitCodeは0（成功）です。テスト実行結果を確認してください。',
      };
    }
  }

  // AC-1.2: exitCode≠0 + PASSのみ → ブロック
  if (exitCode !== 0) {
    const hasOnlySuccess = BLOCKING_SUCCESS_KEYWORDS.some(kw =>
      output.toLowerCase().includes(kw.toLowerCase())
    );
    const hasFailure = BLOCKING_FAILURE_KEYWORDS.some(kw =>
      output.toLowerCase().includes(kw.toLowerCase())
    );
    if (hasOnlySuccess && !hasFailure) {
      return {
        valid: false,
        error: 'テスト出力は全テスト成功を示していますが、exitCodeは非ゼロ（失敗）です。テスト実行結果を確認してください。',
      };
    }
  }

  // AC-1.3: テストフレームワーク構造なし → 警告（ブロックしない）
  const hasFrameworkStructure = TEST_FRAMEWORK_PATTERNS.some(pattern =>
    pattern.test(output)
  );
  if (!hasFrameworkStructure) {
    return {
      valid: true,
      warning: 'テストフレームワークの構造が検出されませんでした。テスト実行の出力であることを確認してください。',
    };
  }

  // エラーパターン検出（警告のみ）
  const hasErrorPattern = ERROR_PATTERNS.some(pattern => pattern.test(output));
  if (hasErrorPattern) {
    return {
      valid: true,
      warning: 'テスト出力にエラーパターン（スタックトレース等）が含まれています。テスト結果を確認してください。',
    };
  }

  return { valid: true };
}
```

##### 3.1.3.3 workflowRecordTestResult関数の修正

```typescript
export function workflowRecordTestResult(
  taskId?: string,
  exitCode?: number,
  summary?: string,
  output?: string
): ToolResult {
  // タスク状態を取得
  const result = getTaskByIdOrError(taskId);
  if ('error' in result) {
    return result.error as ToolResult;
  }

  const { taskState } = result;
  const currentPhase = taskState.phase;

  // testing または regression_test フェーズでのみ許可
  if (currentPhase !== 'testing' && currentPhase !== 'regression_test') {
    return {
      success: false,
      message: `テスト結果の記録はtesting/regression_testフェーズでのみ可能です（現在: ${currentPhase}）`,
    };
  }

  // exitCodeの検証
  if (typeof exitCode !== 'number') {
    return {
      success: false,
      message: 'exitCodeは数値で指定してください',
    };
  }

  // outputパラメータ必須チェック
  if (!output || typeof output !== 'string') {
    return {
      success: false,
      message: 'outputパラメータは必須です。テスト実行の出力を指定してください',
    };
  }

  // output最小長チェック（50文字以上）
  if (output.length < 50) {
    return {
      success: false,
      message: 'outputは50文字以上必要です。テスト実行の完全な出力を指定してください',
    };
  }

  // ★★★ 新規追加: 整合性検証（Fail Closed） ★★★
  const validation = validateTestOutputConsistency(exitCode, output);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
    };
  }

  // 警告がある場合はコンソール出力
  if (validation.warning) {
    console.warn(`[record-test-result] ${validation.warning}`);
  }

  // テスト結果記録を実行（既存ロジック）
  return safeExecute('テスト結果記録', () => {
    const existingResults = taskState.testResults || [];
    const counts = extractTestCounts(output);
    const truncatedOutput = output.length > 500 ? output.slice(-500) : output;

    const newResult = {
      phase: currentPhase as 'testing' | 'regression_test',
      exitCode,
      timestamp: new Date().toISOString(),
      summary: summary || undefined,
      output: truncatedOutput,
      passedCount: counts.passedCount,
      failedCount: counts.failedCount,
    };

    const updatedState = {
      ...taskState,
      testResults: [...existingResults, newResult],
    };

    stateManager.writeTaskState(taskState.workflowDir, updatedState);

    return {
      success: true,
      taskId: taskState.taskId,
      phase: currentPhase,
      result: newResult,
      message: `テスト結果を記録しました（exitCode: ${exitCode}）`,
    };
  }) as ToolResult;
}
```

#### 3.1.4 テストケース

| テストケース | exitCode | output | 期待結果 |
|-------------|----------|--------|---------|
| AC-1.1 | 0 | "5 tests passed, 2 FAILED" | エラー: "失敗キーワードがあるのにexitCode=0" |
| AC-1.2 | 1 | "All tests passed successfully" | エラー: "成功メッセージなのにexitCode≠0" |
| AC-1.3 | 0 | "Everything is fine. No problems detected." | 警告: "テストフレームワーク構造なし" |
| AC-1.4 | 0 | "✓ should validate input\n✓ should handle errors\n\n5 tests passed" | 成功 |
| エラーパターン警告 | 0 | "5 passed\nat user.ts:10:5\nExpected 5 but got 10" | 警告: "エラーパターン検出" |

---

### 3.2 REQ-2: 設計検証の強化

#### 3.2.1 変更対象ファイル

**既存ファイル修正**:
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`

**新規ファイル作成**:
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/ast-analyzer.ts`

#### 3.2.2 AST解析の方針

**重要な設計判断**: TypeScript Compiler APIは使用しない。理由:
- 依存関係が重い（typescript パッケージのサイズ: ~90MB）
- パフォーマンスが低下する可能性
- 正規表現ベースでも十分な精度が得られる

**代替アプローチ**: 正規表現ベースの構造解析
- クラス定義のボディ解析
- メソッド定義のボディ解析
- Mermaid図の遷移・接続カウント

#### 3.2.3 新規ファイル: ast-analyzer.ts

```typescript
/**
 * AST解析モジュール（正規表現ベース）
 *
 * TypeScript Compiler APIを使わず、正規表現で構造を解析する。
 * 軽量かつ高速で、必要十分な精度を提供する。
 *
 * @spec docs/workflows/ワ-クフロ-1000万行対応強化/spec.md
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * クラス定義の解析結果
 */
export interface ClassAnalysis {
  /** クラス名 */
  className: string;
  /** プロパティ・メソッドの数 */
  memberCount: number;
  /** 空のクラスかどうか */
  isEmpty: boolean;
}

/**
 * メソッド定義の解析結果
 */
export interface MethodAnalysis {
  /** メソッド名 */
  methodName: string;
  /** ボディ内のステートメント数（概算） */
  statementCount: number;
  /** 空のメソッドかどうか */
  isEmpty: boolean;
  /** 単なるreturnのみかどうか */
  isOnlyReturn: boolean;
}

/**
 * Mermaid図の解析結果
 */
export interface DiagramAnalysis {
  /** ノード数 */
  nodeCount: number;
  /** エッジ数（遷移・接続） */
  edgeCount: number;
  /** 孤立ノードの配列 */
  isolatedNodes: string[];
}

/**
 * TypeScriptファイルからクラス定義を抽出
 *
 * @param filePath - ファイルパス
 * @returns クラス解析結果の配列
 */
export function analyzeClasses(filePath: string): ClassAnalysis[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const results: ClassAnalysis[] = [];

  // コメント・文字列を除去
  const cleanContent = removeCommentsAndStrings(content);

  // クラス定義を抽出（export class、abstract class など対応）
  const classPattern = /\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{([^}]*)\}/gs;

  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(cleanContent)) !== null) {
    const className = match[1];
    const classBody = match[2];

    // ボディ内のメンバー数をカウント
    const memberCount = countMembers(classBody);
    const isEmpty = memberCount === 0;

    results.push({ className, memberCount, isEmpty });
  }

  return results;
}

/**
 * TypeScriptファイルからメソッド定義を抽出
 *
 * @param filePath - ファイルパス
 * @returns メソッド解析結果の配列
 */
export function analyzeMethods(filePath: string): MethodAnalysis[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const results: MethodAnalysis[] = [];
  const cleanContent = removeCommentsAndStrings(content);

  // メソッド定義を抽出（async対応、アクセス修飾子対応）
  const methodPattern = /\b(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{([^}]*)\}/gs;

  let match: RegExpExecArray | null;
  while ((match = methodPattern.exec(cleanContent)) !== null) {
    const methodName = match[1];
    const methodBody = match[2].trim();

    // ボディのステートメント数をカウント（セミコロンと改行でカウント）
    const statementCount = countStatements(methodBody);
    const isEmpty = methodBody.length === 0;
    const isOnlyReturn = /^\s*return\s*;?\s*$/.test(methodBody);

    results.push({ methodName, statementCount, isEmpty, isOnlyReturn });
  }

  return results;
}

/**
 * Mermaidステートマシン図を解析
 *
 * @param content - Mermaidファイルの内容
 * @returns 図の解析結果
 */
export function analyzeStateMachine(content: string): DiagramAnalysis {
  const nodes = new Set<string>();
  const edges: Array<[string, string]> = [];

  // 状態定義を抽出（[*] は特殊ノード）
  const statePattern = /(\w+)\s*-->/g;
  let match: RegExpExecArray | null;
  while ((match = statePattern.exec(content)) !== null) {
    nodes.add(match[1]);
  }

  // 遷移を抽出（A --> B）
  const transitionPattern = /(\w+|\[\*\])\s*-->\s*(\w+|\[\*\])/g;
  while ((match = transitionPattern.exec(content)) !== null) {
    const from = match[1] === '[*]' ? '_start_' : match[1];
    const to = match[2] === '[*]' ? '_end_' : match[2];
    edges.push([from, to]);
    if (from !== '_start_') nodes.add(from);
    if (to !== '_end_') nodes.add(to);
  }

  // 孤立ノードを検出（エッジに含まれないノード）
  const connectedNodes = new Set<string>();
  for (const [from, to] of edges) {
    connectedNodes.add(from);
    connectedNodes.add(to);
  }
  const isolatedNodes = Array.from(nodes).filter(n => !connectedNodes.has(n));

  return {
    nodeCount: nodes.size,
    edgeCount: edges.length,
    isolatedNodes,
  };
}

/**
 * Mermaidフローチャートを解析
 *
 * @param content - Mermaidファイルの内容
 * @returns 図の解析結果
 */
export function analyzeFlowchart(content: string): DiagramAnalysis {
  const nodes = new Set<string>();
  const edges: Array<[string, string]> = [];

  // ノード定義を抽出（A[Label]、B{Decision} など）
  const nodePattern = /(\w+)[\[\{][^\]\}]*[\]\}]/g;
  let match: RegExpExecArray | null;
  while ((match = nodePattern.exec(content)) !== null) {
    nodes.add(match[1]);
  }

  // エッジを抽出（A --> B、A -.-> B、A ==> B など）
  const edgePattern = /(\w+)\s*(?:-->|-.->|==>|---)\s*(\w+)/g;
  while ((match = edgePattern.exec(content)) !== null) {
    edges.push([match[1], match[2]]);
    nodes.add(match[1]);
    nodes.add(match[2]);
  }

  // 孤立ノードを検出
  const connectedNodes = new Set<string>();
  for (const [from, to] of edges) {
    connectedNodes.add(from);
    connectedNodes.add(to);
  }
  const isolatedNodes = Array.from(nodes).filter(n => !connectedNodes.has(n));

  return {
    nodeCount: nodes.size,
    edgeCount: edges.length,
    isolatedNodes,
  };
}

/**
 * コメントと文字列リテラルを除去
 */
function removeCommentsAndStrings(content: string): string {
  return content
    // ブロックコメント除去 (/* ... */)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 行コメント除去 (// ...)
    .replace(/\/\/.*/g, '')
    // ダブルクォート文字列
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    // シングルクォート文字列
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    // テンプレートリテラル
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * クラスボディ内のメンバー数をカウント
 */
function countMembers(classBody: string): number {
  // プロパティとメソッドをカウント（正規表現でシンプルに）
  const propertyPattern = /\b\w+\s*:\s*\w+/g;
  const methodPattern = /\b\w+\s*\([^)]*\)\s*\{/g;

  const properties = classBody.match(propertyPattern) || [];
  const methods = classBody.match(methodPattern) || [];

  return properties.length + methods.length;
}

/**
 * メソッドボディ内のステートメント数をカウント
 */
function countStatements(methodBody: string): number {
  // セミコロンと改行をステートメント区切りとしてカウント
  const statements = methodBody.split(/[;\n]/).filter(s => s.trim().length > 0);
  return statements.length;
}
```

#### 3.2.4 design-validator.ts の修正

```typescript
/**
 * 設計-実装整合性検証クラス
 * @spec docs/spec/features/design-validator.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ValidationResult, MissingItem } from './types.js';
import { parseSpec } from './parsers/spec-parser.js';
import { parseStateMachine, parseFlowchart } from './parsers/mermaid-parser.js';
// ★★★ 新規追加: AST解析のインポート ★★★
import {
  analyzeClasses,
  analyzeMethods,
  analyzeStateMachine,
  analyzeFlowchart,
  type ClassAnalysis,
  type MethodAnalysis,
  type DiagramAnalysis,
} from './ast-analyzer.js';

export class DesignValidator {
  private workflowDir: string;
  private projectRoot: string;

  constructor(workflowDir: string, projectRoot?: string) {
    this.workflowDir = workflowDir;
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * 全設計書を検証
   */
  validateAll(): ValidationResult {
    const result: ValidationResult = {
      passed: true,
      phase: 'validation',
      timestamp: new Date().toISOString(),
      summary: { total: 0, implemented: 0, missing: 0 },
      missingItems: [],
      warnings: [],
    };

    // ワークフローディレクトリの存在チェック
    if (!fs.existsSync(this.workflowDir)) {
      result.warnings.push('ワークフローディレクトリが見つかりません - 検証をスキップ');
      result.passed = true;
      return result;
    }

    // 設計書ファイルのパス
    const specPath = path.join(this.workflowDir, 'spec.md');
    const stateMachinePath = path.join(this.workflowDir, 'state-machine.mmd');
    const flowchartPath = path.join(this.workflowDir, 'flowchart.mmd');

    // 設計書の存在チェック
    if (!fs.existsSync(specPath)) {
      result.warnings.push('spec.md が見つかりません');
    }
    if (!fs.existsSync(stateMachinePath)) {
      result.warnings.push('state-machine.mmd が見つかりません');
    }
    if (!fs.existsSync(flowchartPath)) {
      result.warnings.push('flowchart.mmd が見つかりません');
    }

    // 全て見つからない場合は検証をスキップ
    if (result.warnings.length >= 3) {
      result.warnings.push('設計書がありません - 検証をスキップ');
      result.passed = true;
      return result;
    }

    // spec.md の検証
    if (fs.existsSync(specPath)) {
      const specContent = fs.readFileSync(specPath, 'utf-8');
      const specItems = parseSpec(specContent);
      this.validateSpecItems(specItems, result);
    }

    // state-machine.mmd の検証（強化版）
    if (fs.existsSync(stateMachinePath)) {
      const smContent = fs.readFileSync(stateMachinePath, 'utf-8');
      const smAnalysis = analyzeStateMachine(smContent);
      this.validateStateMachineDiagram(smAnalysis, result);
    }

    // flowchart.mmd の検証（強化版）
    if (fs.existsSync(flowchartPath)) {
      const fcContent = fs.readFileSync(flowchartPath, 'utf-8');
      const fcAnalysis = analyzeFlowchart(fcContent);
      this.validateFlowchartDiagram(fcAnalysis, result);
    }

    // サマリー計算
    result.summary.missing = result.missingItems.length;
    result.summary.implemented = result.summary.total - result.summary.missing;
    result.passed = result.missingItems.length === 0;

    return result;
  }

  /**
   * spec.md から抽出した項目を検証（AST解析を追加）
   */
  private validateSpecItems(items: SpecItems, result: ValidationResult): void {
    // ファイルパスの存在チェック（既存ロジック維持）
    for (const filePath of items.filePaths) {
      result.summary.total++;
      const fullPath = path.join(this.projectRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        result.missingItems.push({
          type: 'file',
          source: 'spec.md',
          name: filePath,
          expectedPath: fullPath,
        });
      } else {
        // ★★★ 新規追加: ファイルが存在する場合、AST解析を実行 ★★★
        this.validateFileStructure(fullPath, result);
      }
    }

    // クラスの存在チェック（既存ロジック維持）
    for (const className of items.classes) {
      result.summary.total++;
      const found = this.findClassInProject(className, items.filePaths);
      if (!found) {
        result.missingItems.push({
          type: 'class',
          source: 'spec.md',
          name: className,
        });
      }
    }

    // メソッドの存在チェック（既存ロジック維持）
    for (const methodName of items.methods) {
      result.summary.total++;
      const found = this.findMethodInProject(methodName, items.filePaths);
      if (!found) {
        result.missingItems.push({
          type: 'method',
          source: 'spec.md',
          name: methodName,
        });
      }
    }
  }

  /**
   * ★★★ 新規追加: ファイル構造の検証（空クラス・空メソッド検出） ★★★
   */
  private validateFileStructure(filePath: string, result: ValidationResult): void {
    // TypeScript/JavaScriptファイルのみ対象
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      return;
    }

    // クラス解析
    const classes = analyzeClasses(filePath);
    for (const classInfo of classes) {
      if (classInfo.isEmpty) {
        result.warnings.push(
          `空のクラスが検出されました: ${classInfo.className} in ${path.basename(filePath)}`
        );
      }
    }

    // メソッド解析
    const methods = analyzeMethods(filePath);
    for (const methodInfo of methods) {
      if (methodInfo.isEmpty) {
        result.warnings.push(
          `空のメソッドが検出されました: ${methodInfo.methodName} in ${path.basename(filePath)}`
        );
      } else if (methodInfo.isOnlyReturn) {
        result.warnings.push(
          `単なるreturnのみのメソッドが検出されました: ${methodInfo.methodName} in ${path.basename(filePath)}`
        );
      }
    }
  }

  /**
   * ★★★ 新規追加: ステートマシン図の検証（構造的検証） ★★★
   */
  private validateStateMachineDiagram(
    analysis: DiagramAnalysis,
    result: ValidationResult
  ): void {
    // ノード数をカウント
    result.summary.total += analysis.nodeCount;

    // エッジがない場合は警告
    if (analysis.edgeCount === 0 && analysis.nodeCount > 0) {
      result.warnings.push('state-machine.mmd: ノードはありますが、遷移が定義されていません');
    }

    // 孤立ノードがある場合は警告
    if (analysis.isolatedNodes.length > 0) {
      result.warnings.push(
        `state-machine.mmd: 孤立したノードが検出されました: ${analysis.isolatedNodes.join(', ')}`
      );
    }

    // 最低限の遷移数チェック（ノード数-1以上）
    if (analysis.nodeCount > 1 && analysis.edgeCount < analysis.nodeCount - 1) {
      result.warnings.push(
        `state-machine.mmd: 遷移数が不足しています（ノード: ${analysis.nodeCount}, 遷移: ${analysis.edgeCount}）`
      );
    }
  }

  /**
   * ★★★ 新規追加: フローチャートの検証（構造的検証） ★★★
   */
  private validateFlowchartDiagram(
    analysis: DiagramAnalysis,
    result: ValidationResult
  ): void {
    // ノード数をカウント
    result.summary.total += analysis.nodeCount;

    // エッジがない場合はエラー
    if (analysis.edgeCount === 0 && analysis.nodeCount > 0) {
      result.missingItems.push({
        type: 'diagram',
        source: 'flowchart.mmd',
        name: 'edges',
        expectedPath: 'フローチャートに接続がありません',
      });
    }

    // 孤立ノードがある場合は警告
    if (analysis.isolatedNodes.length > 0) {
      result.warnings.push(
        `flowchart.mmd: 孤立したノードが検出されました: ${analysis.isolatedNodes.join(', ')}`
      );
    }
  }

  // 既存のメソッド（findClassInProject, findMethodInProject 等）はそのまま維持
  // ...
}
```

---

### 3.3 REQ-3: スコープ検証の強化

#### 3.3.1 変更対象ファイル

**既存ファイル修正**:
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`

**新規ファイル作成**:
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/dependency-analyzer.ts`

#### 3.3.2 新規ファイル: dependency-analyzer.ts

```typescript
/**
 * 依存関係解析モジュール
 *
 * TypeScript/JavaScriptファイルのimport文を解析し、
 * スコープ外依存を検出する。
 *
 * @spec docs/workflows/ワ-クフロ-1000万行対応強化/spec.md
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * import文の解析結果
 */
export interface ImportInfo {
  /** import元のファイルパス（相対パス） */
  from: string;
  /** 解決後の絶対パス */
  resolvedPath?: string;
  /** ファイルが存在するかどうか */
  exists: boolean;
}

/**
 * 依存関係解析の結果
 */
export interface DependencyAnalysisResult {
  /** スコープ内ファイル */
  scopeFiles: string[];
  /** 検出されたimport文 */
  imports: ImportInfo[];
  /** スコープ外依存（警告対象） */
  outOfScopeDeps: string[];
  /** 推奨スコープ（スコープ外依存を含める） */
  recommendedScope: string[];
}

/**
 * ファイルからimport文を抽出
 *
 * @param filePath - ファイルパス
 * @returns import文の配列
 */
export function extractImports(filePath: string): ImportInfo[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: ImportInfo[] = [];
  const fileDir = path.dirname(filePath);

  // ES6 import パターン
  // import { foo } from './utils';
  // import * as bar from '../helpers';
  const es6ImportPattern = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = es6ImportPattern.exec(content)) !== null) {
    const importPath = match[1];

    // 相対import（./ または ../）のみ対象
    if (!importPath.startsWith('.')) {
      continue;
    }

    const resolvedPath = resolveImportPath(importPath, fileDir);
    const exists = resolvedPath ? fs.existsSync(resolvedPath) : false;

    imports.push({
      from: importPath,
      resolvedPath,
      exists,
    });
  }

  // CommonJS require パターン
  // const foo = require('./utils');
  const requirePattern = /require\s*\(['"]([^'"]+)['"]\)/g;

  while ((match = requirePattern.exec(content)) !== null) {
    const importPath = match[1];

    // 相対import（./ または ../）のみ対象
    if (!importPath.startsWith('.')) {
      continue;
    }

    const resolvedPath = resolveImportPath(importPath, fileDir);
    const exists = resolvedPath ? fs.existsSync(resolvedPath) : false;

    imports.push({
      from: importPath,
      resolvedPath,
      exists,
    });
  }

  return imports;
}

/**
 * スコープの依存関係を解析
 *
 * @param files - スコープに含まれるファイルのパスリスト
 * @param dirs - スコープに含まれるディレクトリのパスリスト
 * @param projectRoot - プロジェクトルート
 * @param maxFiles - 解析するファイルの上限（デフォルト: 1000）
 * @returns 依存関係解析の結果
 */
export function analyzeDependencies(
  files: string[],
  dirs: string[],
  projectRoot: string,
  maxFiles: number = 1000
): DependencyAnalysisResult {
  const scopeFiles = new Set<string>();
  const allImports: ImportInfo[] = [];
  const outOfScopeDeps: string[] = [];

  // ファイル一覧を構築
  for (const file of files) {
    const absolutePath = path.isAbsolute(file) ? file : path.join(projectRoot, file);
    scopeFiles.add(path.normalize(absolutePath));
  }

  for (const dir of dirs) {
    const absoluteDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    const dirFiles = collectFilesInDirectory(absoluteDir, maxFiles);
    dirFiles.forEach(f => scopeFiles.add(f));
  }

  // パフォーマンス対策: ファイル数制限
  if (scopeFiles.size > maxFiles) {
    console.warn(`[dependency-analyzer] スコープファイル数が${maxFiles}を超えています。解析をスキップします。`);
    return {
      scopeFiles: Array.from(scopeFiles),
      imports: [],
      outOfScopeDeps: [],
      recommendedScope: Array.from(scopeFiles),
    };
  }

  // 各ファイルのimportを解析
  for (const file of scopeFiles) {
    // TypeScript/JavaScriptファイルのみ対象
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) {
      continue;
    }

    const imports = extractImports(file);
    allImports.push(...imports);

    // スコープ外依存を検出
    for (const imp of imports) {
      if (imp.resolvedPath && imp.exists) {
        const normalizedPath = path.normalize(imp.resolvedPath);
        if (!scopeFiles.has(normalizedPath)) {
          outOfScopeDeps.push(normalizedPath);
        }
      }
    }
  }

  // 重複を除去
  const uniqueOutOfScope = Array.from(new Set(outOfScopeDeps));

  // 推奨スコープ = 元のスコープ + スコープ外依存
  const recommendedScope = Array.from(new Set([
    ...files,
    ...uniqueOutOfScope.map(p => path.relative(projectRoot, p)),
  ]));

  return {
    scopeFiles: Array.from(scopeFiles),
    imports: allImports,
    outOfScopeDeps: uniqueOutOfScope,
    recommendedScope,
  };
}

/**
 * import文のパスを解決
 *
 * @param importPath - import文のパス
 * @param fromDir - importしているファイルのディレクトリ
 * @returns 解決された絶対パス（解決できない場合はundefined）
 */
function resolveImportPath(importPath: string, fromDir: string): string | undefined {
  // 拡張子を試行（.ts, .tsx, .js, .jsx, /index.ts など）
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const candidates = [
    importPath,
    ...extensions.map(ext => `${importPath}${ext}`),
    ...extensions.map(ext => `${importPath}/index${ext}`),
  ];

  for (const candidate of candidates) {
    const resolvedPath = path.resolve(fromDir, candidate);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  return undefined;
}

/**
 * ディレクトリ内のファイルを再帰的に収集
 *
 * @param dir - ディレクトリパス
 * @param maxFiles - 収集する最大ファイル数
 * @returns ファイルパスの配列
 */
function collectFilesInDirectory(dir: string, maxFiles: number): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    if (files.length >= maxFiles) {
      return;
    }

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) {
          break;
        }

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // node_modules, .git 等は除外
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // ディレクトリ読み込みエラーは無視
    }
  }

  walk(dir);
  return files;
}
```

#### 3.3.3 set-scope.ts の修正

```typescript
/**
 * workflow_set_scope ツール - 影響範囲を設定
 *
 * research/requirements/planningフェーズで変更対象ファイル/ディレクトリをTaskStateに記録する。
 *
 * @spec docs/workflows/ワークフロー大規模対応改善/spec.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { stateManager } from '../state/manager.js';
import type { ToolResult } from '../state/types.js';
import { getTaskByIdOrError, safeExecute } from './helpers.js';
// ★★★ 新規追加: 依存関係解析のインポート ★★★
import { analyzeDependencies } from '../validation/dependency-analyzer.js';

/** スコープ設定が可能なフェーズ */
const ALLOWED_PHASES = ['research', 'requirements', 'planning'] as const;

/**
 * 影響範囲を設定
 *
 * @param taskId タスクID（必須）
 * @param files 影響を受けるファイルの配列
 * @param dirs 影響を受けるディレクトリの配列
 * @returns 設定結果
 */
export function workflowSetScope(
  taskId?: string,
  files?: string[],
  dirs?: string[]
): ToolResult {
  // タスク状態を取得
  const result = getTaskByIdOrError(taskId);
  if ('error' in result) {
    return result.error as ToolResult;
  }

  const { taskState } = result;
  const currentPhase = taskState.phase;

  // research/requirements/planningフェーズでのみ許可
  if (!ALLOWED_PHASES.includes(currentPhase as typeof ALLOWED_PHASES[number])) {
    return {
      success: false,
      message: `影響範囲の設定はresearch/requirements/planningフェーズでのみ可能です（現在: ${currentPhase}）`,
    };
  }

  // 引数検証
  const affectedFiles = Array.isArray(files) ? files : [];
  const affectedDirs = Array.isArray(dirs) ? dirs : [];

  // ★★★ 新規追加: 空スコープのブロック ★★★
  if (affectedFiles.length === 0 && affectedDirs.length === 0) {
    return {
      success: false,
      message: 'files または dirs の少なくとも1つを指定してください',
    };
  }

  // ★★★ 新規追加: ファイル/ディレクトリの存在チェック ★★★
  const projectRoot = process.cwd();
  const nonExistentFiles: string[] = [];
  const nonExistentDirs: string[] = [];

  for (const file of affectedFiles) {
    const absolutePath = path.isAbsolute(file) ? file : path.join(projectRoot, file);
    if (!fs.existsSync(absolutePath)) {
      nonExistentFiles.push(file);
    }
  }

  for (const dir of affectedDirs) {
    const absolutePath = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      nonExistentDirs.push(dir);
    }
  }

  // 存在しないファイル/ディレクトリがあればエラー
  if (nonExistentFiles.length > 0 || nonExistentDirs.length > 0) {
    const errors: string[] = [];
    if (nonExistentFiles.length > 0) {
      errors.push(`存在しないファイル: ${nonExistentFiles.join(', ')}`);
    }
    if (nonExistentDirs.length > 0) {
      errors.push(`存在しないディレクトリ: ${nonExistentDirs.join(', ')}`);
    }
    return {
      success: false,
      message: errors.join('\n'),
    };
  }

  // ★★★ 新規追加: 依存関係解析 ★★★
  const depAnalysis = analyzeDependencies(affectedFiles, affectedDirs, projectRoot);

  // スコープ外依存がある場合は警告（ブロックはしない）
  if (depAnalysis.outOfScopeDeps.length > 0) {
    const relativeOutOfScope = depAnalysis.outOfScopeDeps
      .map(p => path.relative(projectRoot, p))
      .slice(0, 10); // 最大10件表示

    console.warn('[set-scope] スコープ外依存が検出されました:');
    console.warn(`  依存ファイル: ${relativeOutOfScope.join(', ')}`);
    if (depAnalysis.outOfScopeDeps.length > 10) {
      console.warn(`  ... 他 ${depAnalysis.outOfScopeDeps.length - 10} 件`);
    }
    console.warn('');
    console.warn('推奨スコープ（依存ファイルを含む）:');
    console.warn(`  files: ${JSON.stringify(depAnalysis.recommendedScope, null, 2)}`);
    console.warn('');
  }

  // スコープ設定を実行
  return safeExecute('影響範囲設定', () => {
    // TaskStateにスコープを記録
    const updatedState = {
      ...taskState,
      scope: {
        affectedFiles,
        affectedDirs,
      },
    };

    stateManager.writeTaskState(taskState.workflowDir, updatedState);

    return {
      success: true,
      taskId: taskState.taskId,
      scope: {
        affectedFiles,
        affectedDirs,
      },
      message: `影響範囲を設定しました（ファイル: ${affectedFiles.length}件, ディレクトリ: ${affectedDirs.length}件）`,
      ...(depAnalysis.outOfScopeDeps.length > 0 && {
        warnings: [`スコープ外依存が${depAnalysis.outOfScopeDeps.length}件検出されました（詳細はコンソールを確認）`],
      }),
    };
  }) as ToolResult;
}

// ツール定義（既存のまま維持）
export const setScopeToolDefinition = {
  name: 'workflow_set_scope',
  description: 'タスクの影響範囲（変更対象ファイル/ディレクトリ）を設定します。research/requirements/planningフェーズで使用可能です。',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'タスクID（必須）',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: '影響を受けるファイルのパスリスト',
      },
      dirs: {
        type: 'array',
        items: { type: 'string' },
        description: '影響を受けるディレクトリのパスリスト',
      },
    },
    required: [],
  },
};
```

---

### 3.4 REQ-4: 環境変数バイパスの監査

#### 3.4.1 新規ファイル: audit/logger.ts

```typescript
/**
 * 監査ログ記録モジュール（ESM）
 *
 * 環境変数バイパス（SKIP_*）の使用を.claude/state/audit-log.jsonlに記録する。
 * JSONL形式（JSON Lines）でログを追記し、ローテーションを実施する。
 *
 * @spec docs/workflows/ワ-クフロ-1000万行対応強化/spec.md
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 監査ログのイベント種別
 */
export type AuditEventType =
  | 'bypass_enabled'           // バイパス環境変数が有効
  | 'bypass_threshold_exceeded'; // バイパス使用回数が閾値超過

/**
 * 監査ログエントリ
 */
export interface AuditLogEntry {
  /** タイムスタンプ（ISO8601形式） */
  timestamp: string;
  /** イベント種別 */
  event: AuditEventType;
  /** 環境変数名（bypass_enabledの場合） */
  variable?: string;
  /** タスクID（存在する場合） */
  taskId?: string;
  /** フェーズ（存在する場合） */
  phase?: string;
  /** カウント（bypass_threshold_exceededの場合） */
  count?: number;
  /** 時間窓（bypass_threshold_exceededの場合） */
  window?: string;
}

/**
 * 監査ログ記録クラス
 */
export class AuditLogger {
  private logFilePath: string;
  private maxLogSize: number;
  private maxGenerations: number;

  /**
   * コンストラクタ
   *
   * @param logDir - ログディレクトリ（デフォルト: .claude/state/）
   * @param maxLogSize - ローテーション閾値（バイト、デフォルト: 10MB）
   * @param maxGenerations - 保持する世代数（デフォルト: 5）
   */
  constructor(
    logDir: string = path.join(process.cwd(), '.claude', 'state'),
    maxLogSize: number = 10 * 1024 * 1024, // 10MB
    maxGenerations: number = 5
  ) {
    this.logFilePath = path.join(logDir, 'audit-log.jsonl');
    this.maxLogSize = maxLogSize;
    this.maxGenerations = maxGenerations;

    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 監査ログを記録
   *
   * @param entry - ログエントリ
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    try {
      // JSONL形式で追記（各行が1つのJSONオブジェクト）
      const line = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');

      // ローテーションチェック
      this.rotateIfNeeded();
    } catch (e) {
      // ログ書き込み失敗は標準エラー出力に出力して継続
      console.error('[audit-logger] ログ書き込み失敗:', e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * 過去1時間のバイパス使用回数をカウント
   *
   * @returns バイパス使用回数
   */
  countRecentBypasses(): number {
    if (!fs.existsSync(this.logFilePath)) {
      return 0;
    }

    try {
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      let count = 0;

      for (const line of lines) {
        try {
          const entry: AuditLogEntry = JSON.parse(line);
          if (entry.event === 'bypass_enabled') {
            const entryTime = new Date(entry.timestamp);
            if (entryTime >= oneHourAgo) {
              count++;
            }
          }
        } catch {
          // JSON parse error は無視
        }
      }

      return count;
    } catch (e) {
      console.error('[audit-logger] ログ読み込み失敗:', e instanceof Error ? e.message : String(e));
      return 0;
    }
  }

  /**
   * バイパス使用回数が閾値を超えた場合に警告
   *
   * @param threshold - 閾値（デフォルト: 10）
   */
  checkThreshold(threshold: number = 10): void {
    const count = this.countRecentBypasses();
    if (count > threshold) {
      console.warn(`[audit-logger] バイパス使用回数が閾値を超えました（${count} > ${threshold}）`);
      console.warn('[audit-logger] 詳細: .claude/state/audit-log.jsonl を確認してください');

      // 閾値超過イベントを記録
      this.log({
        event: 'bypass_threshold_exceeded',
        count,
        window: '1h',
      });
    }
  }

  /**
   * ログローテーション
   *
   * ログファイルがmaxLogSizeを超えた場合、.1, .2, ... .N とローテーションする。
   */
  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.logFilePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size < this.maxLogSize) {
        return;
      }

      // 既存の世代をシフト（.4 → .5, .3 → .4, ...）
      for (let i = this.maxGenerations - 1; i >= 1; i--) {
        const oldPath = `${this.logFilePath}.${i}`;
        const newPath = `${this.logFilePath}.${i + 1}`;
        if (fs.existsSync(oldPath)) {
          if (i === this.maxGenerations - 1) {
            // 最古の世代は削除
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // 現在のログを .1 にリネーム
      fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
    } catch (e) {
      console.error('[audit-logger] ローテーション失敗:', e instanceof Error ? e.message : String(e));
    }
  }
}

/**
 * シングルトンインスタンス
 */
export const auditLogger = new AuditLogger();
```

#### 3.4.2 フックへの統合（CommonJS対応）

フックファイルはCommonJSで記述されており、ESMのaudit/logger.tsをインポートできない。
代わりに、フック側で直接ファイル書き込みを行う。

##### phase-edit-guard.js への追加

```javascript
// ファイル先頭に追加
const AUDIT_LOG_PATH = path.join(process.cwd(), '.claude', 'state', 'audit-log.jsonl');

/**
 * 監査ログを記録（CommonJS版、同期処理）
 * @param {object} entry - ログエントリ
 */
function logAudit(entry) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const line = JSON.stringify(logEntry) + '\n';

    // ディレクトリが存在しない場合は作成
    const logDir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf-8');
  } catch (e) {
    // ログ書き込み失敗は無視（本処理に影響しないため）
  }
}

// main関数内の先頭に追加
function main(input) {
  try {
    // 入力の検証（不正な入力は許可して処理を進める）
    if (!input || typeof input !== 'object') {
      process.exit(EXIT_CODES.SUCCESS);
    }

    // ★★★ 新規追加: SKIP_PHASE_GUARD のログ記録 ★★★
    if (process.env.SKIP_PHASE_GUARD === 'true') {
      debugLog('SKIP_PHASE_GUARD=true によりチェックを無効化');

      // 監査ログに記録
      logAudit({
        event: 'bypass_enabled',
        variable: 'SKIP_PHASE_GUARD',
        taskId: null, // タスク情報はこの時点では不明
        phase: null,
      });

      logCheck({ skipped: true, reason: 'SKIP_PHASE_GUARD=true' });
      process.exit(EXIT_CODES.SUCCESS);
    }

    // ... 既存の処理
  }
}
```

##### enforce-workflow.js への追加

同様の`logAudit`関数を追加し、環境変数チェック時に記録する。

##### block-dangerous-commands.js への追加

同様の`logAudit`関数を追加し、環境変数チェック時に記録する。

---

## 4. エラーハンドリング

### 4.1 ファイルシステムエラー

| エラー種別 | 対応方針 |
|-----------|---------|
| ディスク容量不足 | 警告のみ（ブロックしない） |
| 権限エラー | 警告のみ（ブロックしない） |
| ファイル未存在 | スコープ設定時はブロック、その他は警告 |

### 4.2 AST解析エラー

| エラー種別 | 対応方針 |
|-----------|---------|
| 構文エラー | フォールバック（正規表現ベースの検証に戻す） |
| 巨大ファイル（10,000行超） | AST解析をスキップ（警告のみ） |

### 4.3 依存関係解析エラー

| エラー種別 | 対応方針 |
|-----------|---------|
| import解析失敗 | 警告のみ（スコープ設定は継続） |
| ファイル数超過（1000超） | 依存関係解析をスキップ（警告のみ） |

### 4.4 監査ログ書き込みエラー

| エラー種別 | 対応方針 |
|-----------|---------|
| ログ書き込み失敗 | 標準エラー出力に出力して継続 |
| ローテーション失敗 | 標準エラー出力に出力して継続 |

---

## 5. パフォーマンス要件

| 項目 | 目標値 |
|------|--------|
| AST解析（1000行ファイル） | 100ms以内 |
| import解析（100ファイル） | 3秒以内 |
| 監査ログ書き込み | 10ms以内 |
| スコープ検証（100ファイル） | 3秒以内 |

---

## 6. テスト戦略

### 6.1 ユニットテスト

#### REQ-1: record-test-result-enhanced.test.ts

```typescript
describe('workflowRecordTestResult - 整合性検証', () => {
  it('AC-1.1: exitCode=0 + FAILキーワード → ブロック', () => {
    const result = workflowRecordTestResult(taskId, 0, undefined, '5 tests passed, 2 FAILED');
    expect(result.success).toBe(false);
    expect(result.message).toContain('失敗を示すキーワード');
  });

  it('AC-1.2: exitCode≠0 + PASSのみ → ブロック', () => {
    const result = workflowRecordTestResult(taskId, 1, undefined, 'All tests passed successfully');
    expect(result.success).toBe(false);
    expect(result.message).toContain('成功を示していますが');
  });

  it('AC-1.3: テストフレームワーク構造なし → 警告', () => {
    const result = workflowRecordTestResult(taskId, 0, undefined, 'Everything is fine. No problems detected. This is a very long output that exceeds 50 characters.');
    expect(result.success).toBe(true);
    // コンソール警告の確認（スパイ使用）
  });

  it('AC-1.4: 正常なケース', () => {
    const result = workflowRecordTestResult(taskId, 0, undefined, '✓ should validate input\n✓ should handle errors\n\n5 tests passed');
    expect(result.success).toBe(true);
  });
});
```

#### REQ-2: ast-analyzer.test.ts

```typescript
describe('analyzeClasses', () => {
  it('空のクラスを検出', () => {
    const testFile = 'test-class-empty.ts';
    fs.writeFileSync(testFile, 'export class EmptyClass {}');
    const results = analyzeClasses(testFile);
    expect(results[0].isEmpty).toBe(true);
    fs.unlinkSync(testFile);
  });

  it('メンバーを持つクラスを検出', () => {
    const testFile = 'test-class-members.ts';
    fs.writeFileSync(testFile, 'class User { name: string; getUser() {} }');
    const results = analyzeClasses(testFile);
    expect(results[0].isEmpty).toBe(false);
    expect(results[0].memberCount).toBeGreaterThan(0);
    fs.unlinkSync(testFile);
  });
});

describe('analyzeMethods', () => {
  it('空のメソッドを検出', () => {
    const testFile = 'test-method-empty.ts';
    fs.writeFileSync(testFile, 'class Foo { bar() {} }');
    const results = analyzeMethods(testFile);
    expect(results[0].isEmpty).toBe(true);
    fs.unlinkSync(testFile);
  });

  it('単なるreturnのみのメソッドを検出', () => {
    const testFile = 'test-method-return.ts';
    fs.writeFileSync(testFile, 'class Foo { bar() { return; } }');
    const results = analyzeMethods(testFile);
    expect(results[0].isOnlyReturn).toBe(true);
    fs.unlinkSync(testFile);
  });
});
```

#### REQ-3: dependency-analyzer.test.ts

```typescript
describe('extractImports', () => {
  it('ES6 import を抽出', () => {
    const testFile = 'test-imports.ts';
    fs.writeFileSync(testFile, "import { foo } from './utils';\nimport * as bar from '../helpers';");
    const results = extractImports(testFile);
    expect(results).toHaveLength(2);
    expect(results[0].from).toBe('./utils');
    expect(results[1].from).toBe('../helpers');
    fs.unlinkSync(testFile);
  });

  it('CommonJS require を抽出', () => {
    const testFile = 'test-require.js';
    fs.writeFileSync(testFile, "const foo = require('./utils');\nconst bar = require('../helpers');");
    const results = extractImports(testFile);
    expect(results).toHaveLength(2);
    fs.unlinkSync(testFile);
  });
});

describe('analyzeDependencies', () => {
  it('スコープ外依存を検出', () => {
    // テストフィクスチャを作成
    // ...
    const result = analyzeDependencies(['file1.ts'], [], projectRoot);
    expect(result.outOfScopeDeps.length).toBeGreaterThan(0);
  });
});
```

#### REQ-4: logger.test.ts

```typescript
describe('AuditLogger', () => {
  it('ログを記録', () => {
    const logger = new AuditLogger('/tmp/test-audit');
    logger.log({ event: 'bypass_enabled', variable: 'SKIP_PHASE_GUARD' });
    const content = fs.readFileSync('/tmp/test-audit/audit-log.jsonl', 'utf-8');
    expect(content).toContain('bypass_enabled');
  });

  it('ローテーション', () => {
    // 巨大ログを生成してローテーションをテスト
  });

  it('バイパス回数カウント', () => {
    const logger = new AuditLogger('/tmp/test-audit');
    // 11回のバイパスログを記録
    for (let i = 0; i < 11; i++) {
      logger.log({ event: 'bypass_enabled', variable: 'SKIP_PHASE_GUARD' });
    }
    const count = logger.countRecentBypasses();
    expect(count).toBe(11);
  });
});
```

---

## 7. デプロイ計画

### 7.1 段階的リリース

| Phase | 内容 | 対象 |
|-------|------|------|
| Phase 1 | REQ-4（監査ログ）の実装・デプロイ | 全フック |
| Phase 2 | REQ-1（テスト結果偽造防止）の実装・デプロイ | record-test-result.ts |
| Phase 3 | REQ-2（設計検証強化）の実装・デプロイ | design-validator.ts |
| Phase 4 | REQ-3（スコープ検証強化）の実装・デプロイ | set-scope.ts |

### 7.2 ロールバック計画

各Phaseで問題が発生した場合、環境変数でバイパス可能（監査ログに記録）：
- `SKIP_PHASE_GUARD=true`
- `SKIP_DESIGN_VALIDATION=true`
- `FAIL_OPEN=true`（最終手段）

---

## 8. 関連ファイル

<!-- @related-files -->
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/record-test-result.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/ast-analyzer.ts`（新規）
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/dependency-analyzer.ts`（新規）
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/audit/logger.ts`（新規）
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/enforce-workflow.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/block-dangerous-commands.js`
<!-- @end-related-files -->

---

**文書承認**: planning サブフェーズ完了
**次のフェーズ**: parallel_design (state_machine + flowchart + ui_design)
