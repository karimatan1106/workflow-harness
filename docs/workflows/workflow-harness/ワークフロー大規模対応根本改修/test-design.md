# テスト設計書: ワークフロー大規模対応根本改修

**作成日**: 2026-02-07
**対象**: REQ-1（スコープ必須化）, REQ-2（テスト証拠検証）, REQ-3（Fail Closed）
**テストフレームワーク**: Vitest
**仕様書**: docs/workflows/ワ-クフロ-大規模対応根本改修/spec.md

---

## 1. テストファイル構成

```
mcp-server/src/tools/__tests__/
  next-scope-check.test.ts         - REQ-1: next.tsのスコープ必須チェック
  set-scope-expanded.test.ts       - REQ-1: set-scope.tsのフェーズ拡張
  record-test-result-output.test.ts - REQ-2: outputパラメータ検証
mcp-server/src/validation/__tests__/
  scope-enforcement-expanded.test.ts - REQ-1: スコープ検証フェーズ拡大+未設定時ブロック
mcp-server/src/hooks/__tests__/
  fail-closed.test.ts               - REQ-3: Fail Closed化テスト
```

---

## 2. REQ-1: スコープ制御テスト

### 2.1 next-scope-check.test.ts

planningフェーズからparallel_designへの遷移時にscope必須チェックが動作するかテスト。

**モック対象**: `stateManager.writeTaskState`, `stateManager.updateTaskPhase`, `stateManager.getIncompleteSubPhases`

#### テストケース

| ID | テスト名 | 前提条件 | 期待結果 |
|----|---------|---------|---------|
| TC-1.1 | planningフェーズでscope未設定→遷移ブロック | phase='parallel_analysis', subPhases全完了, scope=undefined | success=false, message含む「スコープが設定されていません」 |
| TC-1.1b | planningフェーズでscope空→遷移ブロック | phase='parallel_analysis', scope={affectedFiles:[],affectedDirs:[]} | success=false |
| TC-1.2 | planningフェーズでscope設定済み→遷移成功 | phase='parallel_analysis', subPhases全完了, scope={affectedDirs:['src/backend/']} | success=true, to='parallel_design' |
| TC-1.2b | scopeにaffectedFilesのみ設定→遷移成功 | scope={affectedFiles:['src/a.ts'],affectedDirs:[]} | success=true |
| TC-1.2c | 他フェーズはscopeチェック無し | phase='requirements' | scopeなしでもsuccess=true |

**補足**: next.tsのplanningフェーズチェックは、parallel_analysisフェーズの全subPhases完了後にworkflow_nextが呼ばれた時点で発動する。実装上はplanningサブフェーズの完了をトリガーにするのではなく、parallel_analysisフェーズからparallel_designフェーズへの遷移時にscopeを検証する。

### 2.2 set-scope-expanded.test.ts

set-scope.tsのフェーズ制限拡張テスト。

**モック対象**: `stateManager.writeTaskState`

#### テストケース

| ID | テスト名 | 前提条件 | 期待結果 |
|----|---------|---------|---------|
| TC-SS-1 | researchフェーズでscope設定可能 | phase='research' | success=true |
| TC-SS-2 | requirementsフェーズでscope設定可能 | phase='requirements' | success=true |
| TC-SS-3 | planningフェーズでscope設定可能 | phase='planning' (※サブフェーズ) | success=true |
| TC-SS-4 | implementationフェーズでscope設定不可 | phase='implementation' | success=false, message含む「research/requirements/planning」 |
| TC-SS-5 | testingフェーズでscope設定不可 | phase='testing' | success=false |
| TC-SS-6 | 空配列のみ指定→エラー | files=[], dirs=[] | success=false |
| TC-SS-7 | filesのみ指定→成功 | files=['src/a.ts'], dirs=undefined | success=true |
| TC-SS-8 | dirsのみ指定→成功 | files=undefined, dirs=['src/backend/'] | success=true |

### 2.3 scope-enforcement-expanded.test.ts

phase-edit-guard.jsのcheckScopeViolation()のスコープ検証拡大テスト。

**テスト対象**: `checkScopeViolation()` 関数（module.exportsから取得）

#### テストケース: スコープ検証フェーズ拡大

| ID | テスト名 | フェーズ | 入力 | 期待結果 |
|----|---------|--------|------|---------|
| TC-1.3 | test_implフェーズでスコープ外編集→ブロック | test_impl | スコープ外のsrc/ファイル | blocked=true |
| TC-1.4 | implementationフェーズでスコープ内編集→許可 | implementation | スコープ内ファイル | blocked=false |
| TC-SE-1 | build_checkフェーズでスコープ外→ブロック | build_check | スコープ外ファイル | blocked=true |
| TC-SE-2 | testingフェーズでスコープ外→ブロック | testing | スコープ外ファイル | blocked=true |
| TC-1.5 | docs配下は常に許可 | test_impl | docs/workflows/xxx.md | blocked=false |

#### テストケース: scope未設定時のsrc/ブロック

| ID | テスト名 | scope状態 | 入力 | 期待結果 |
|----|---------|----------|------|---------|
| TC-1.6 | scope未設定→src/配下ブロック | scope=undefined | src/backend/index.ts | blocked=true, reason含む「スコープが未設定」 |
| TC-SE-3 | scope空配列→src/配下ブロック | scope={affectedFiles:[],affectedDirs:[]} | src/backend/index.ts | blocked=true, reason含む「スコープが空」 |
| TC-SE-4 | scope未設定→docs/配下は許可 | scope=undefined | docs/spec/feature.md | blocked=false |
| TC-SE-5 | scope未設定→config等は許可 | scope=undefined | package.json | blocked=false |
| TC-SE-6 | workflowState=null→許可 | workflowState=null | src/any/file.ts | blocked=false |

---

## 3. REQ-2: テスト証拠検証テスト

### 3.1 record-test-result-output.test.ts

record-test-result.tsのoutputパラメータ検証テスト。

**モック対象**: `stateManager.writeTaskState`

#### テストケース

| ID | テスト名 | 入力 | 期待結果 |
|----|---------|------|---------|
| TC-2.1 | outputなし→エラー | exitCode=0, summary='ok', output=undefined | success=false, message含む「output」 |
| TC-2.6 | output50文字未満→エラー | output='short' | success=false, message含む「50文字」 |
| TC-2.2 | 正常なテスト出力→成功+件数抽出 | output='... 5 tests passed ...'(100文字以上) | success=true, passedCount=5 |
| TC-2.3 | テストキーワードなし→警告+成功 | output='aaaa...bbbb'(100文字,キーワードなし) | success=true, console.warn呼出 |
| TC-2.4 | exitCode=0+FAIL含む→警告+成功 | exitCode=0, output='...FAIL...'(100文字) | success=true, console.warn呼出 |
| TC-2.5 | テスト件数抽出（passed+failed） | output='10 tests, 2 failed, 8 passed' | passedCount=8, failedCount=2 |
| TC-RTO-1 | outputが500文字以上→末尾500文字のみ保存 | output=1000文字の文字列 | 保存されたoutput.length<=500 |
| TC-RTO-2 | regression_testフェーズでも動作 | phase='regression_test' | success=true |
| TC-RTO-3 | vitest形式の出力パース | output='Tests: 42 passed, 42 total' | passedCount=42 |
| TC-RTO-4 | jest形式の出力パース | output='Tests: 3 failed, 39 passed, 42 total' | failedCount=3, passedCount=39 |
| TC-RTO-5 | exitCode未指定→エラー | exitCode=undefined | success=false |
| TC-RTO-6 | 不正フェーズ→エラー | phase='implementation' | success=false |

---

## 4. REQ-3: Fail Closedテスト

### 4.1 fail-closed.test.ts

3つのフックスクリプトのFail Closed動作テスト。

**テスト手法**: `child_process.execSync`でフックを実行し、exit codeを検証

#### テストケース: phase-edit-guard.js

| ID | テスト名 | 入力 | 環境変数 | 期待結果 |
|----|---------|------|---------|---------|
| TC-3.1 | 不正JSON入力→exit 2 | 不正なJSON文字列 | なし | exit code 2 |
| TC-3.1b | 正常入力→exit 0 | 正常なEdit入力JSON | SKIP_PHASE_GUARD=true | exit code 0 |
| TC-3.4 | FAIL_OPEN=true→exit 0 | 不正なJSON | FAIL_OPEN=true | exit code 0, stderr含む「FAIL_OPEN」 |

#### テストケース: enforce-workflow.js

| ID | テスト名 | 入力 | 環境変数 | 期待結果 |
|----|---------|------|---------|---------|
| TC-3.2 | 不正JSON入力→exit 2 | 不正なJSON | なし | exit code 2 |
| TC-3.2b | FAIL_OPEN=true→exit 0 | 不正なJSON | FAIL_OPEN=true | exit code 0 |

#### テストケース: block-dangerous-commands.js

| ID | テスト名 | 入力 | 環境変数 | 期待結果 |
|----|---------|------|---------|---------|
| TC-3.3 | 不正JSON入力→exit 2 | 不正なJSON | なし | exit code 2 |
| TC-3.3b | FAIL_OPEN=true→exit 0 | 不正なJSON | FAIL_OPEN=true | exit code 0 |

#### テストケース: check-workflow-artifact.js（対象外確認）

| ID | テスト名 | 期待結果 |
|----|---------|---------|
| TC-3.5 | check-workflow-artifact.jsはFail Open維持 | エラー時exit 0（変更なし） |

---

## 5. テスト実装ガイド

### 5.1 MCPツールテストのモックパターン

```typescript
import { vi, describe, test, expect, beforeEach } from 'vitest';

// stateManagerのモック
vi.mock('../../state/manager.js', () => ({
  stateManager: {
    writeTaskState: vi.fn(),
    updateTaskPhase: vi.fn(),
    getIncompleteSubPhases: vi.fn(() => []),
    discoverTasks: vi.fn(() => []),
  },
}));

// テスト用TaskStateファクトリ
function createMockTaskState(overrides = {}) {
  return {
    phase: 'testing',
    taskId: 'test-task-001',
    taskName: 'テストタスク',
    workflowDir: '/tmp/test-workflow',
    docsDir: '/tmp/test-docs',
    startedAt: '2026-02-07T00:00:00Z',
    checklist: {},
    history: [],
    subPhases: {},
    taskSize: 'large',
    ...overrides,
  };
}
```

### 5.2 フックテストのsubprocess実行パターン

```typescript
import { execSync } from 'child_process';
import path from 'path';

function runHook(hookFile: string, input: string, env: Record<string, string> = {}) {
  const hookPath = path.resolve(__dirname, '../../../../hooks', hookFile);
  try {
    const result = execSync(`echo '${input}' | node "${hookPath}"`, {
      env: { ...process.env, ...env },
      timeout: 5000,
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: result, stderr: '' };
  } catch (e: any) {
    return { exitCode: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}
```

### 5.3 テスト実行コマンド

```bash
cd workflow-plugin/mcp-server && npx vitest run
```

---

## 6. テストカバレッジ目標

| 対象ファイル | 目標カバレッジ | 重要パス |
|-------------|---------------|---------|
| next.ts | 90%+ | planningフェーズscope検証パス |
| set-scope.ts | 95%+ | 全フェーズ制限パス |
| record-test-result.ts | 95%+ | output検証、件数抽出 |
| phase-edit-guard.js (checkScopeViolation) | 90%+ | 未設定時ブロック、フェーズ拡大 |
| hooks/Fail Closed | exit code検証 | 全catchブロック |

---

## 7. テスト合計

| カテゴリ | テストケース数 |
|---------|-------------|
| REQ-1: next-scope-check | 5 |
| REQ-1: set-scope-expanded | 8 |
| REQ-1: scope-enforcement-expanded | 11 |
| REQ-2: record-test-result-output | 12 |
| REQ-3: fail-closed | 7 |
| **合計** | **43** |
